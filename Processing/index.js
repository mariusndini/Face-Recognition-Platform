const jimp = require('jimp');
const AWS = require('aws-sdk');
const config = require('./config.json');
const s3 = new AWS.S3(config.S3);
const rekognition = new AWS.Rekognition(config.rekognition)
const snowflake = require('./snowflakeWrapper.js');
var dbConn = null;

exports.handler = async (event) => {
    return cropFaces( event.img, event.pose, event.metadata)
    .then((data)=>{
        console.log(data);
        return data;
    }).catch((error)=>{
        console.log(error);
        return error;
    });



};


function cropFaces(img, pose, metadata){
    var funcdata = {};
    funcdata.metadata = metadata;

    var start =  new Date().getTime();
    funcdata.time = start;
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    var path = yyyy + '/' + mm + '/' + dd;

    var name = 'IMGID.' + start + '.' + Math.round(Math.random()*1000000);

	console.log('Starting BIG Promise');

    return new Promise((resolve, reject)=>{
        return snowflake.connect()//connect to database and get connection
        .then((con)=>{
            dbConn = con;
            return detectFaces(img);

        })
		.then((data)=>{ // Detect all faces in an image
            var faces = [];
            funcdata.facesdetected = data.facedata;
            
            function getFaceBoxes(){
                for(i=0; i < data.facedata.FaceDetails.length; i++){
                    if(data.facedata.FaceDetails[i].Confidence > 95){
                        faces.push(data.facedata.FaceDetails[i].BoundingBox);
                    }
                }
            }//end function
            getFaceBoxes();
            return jimpCrop( faces, data.img ); // crop all faces in image

        })
        .then((jimpCrop)=>{ 
            var functions = [];
            var s3Func = [];

            for(i=0; i < jimpCrop.length; i++){ //from all of the cropped images see if they are in our collection
                funcdata.facesdetected.FaceDetails[i].faceImg = jimpCrop[i];
                funcdata.facesdetected.FaceDetails[i].fceImg = 'rekimagesmarius/' + path + '/fce/'+ name + '.' + i +'.jpg';
                s3Func.push( putS3( jimpCrop[i], (name + '.' + i +'.jpg'), 'rekimagesmarius/' + path + '/fce') );
                functions.push( searchImage( funcdata.facesdetected.FaceDetails[i]) );
            }

            return Promise.all(s3Func).then(()=>{
                return Promise.all(functions);
            })
            
        })
        .then((data)=>{
            var needIndexing = [];
            for(i=0; i < data.length; i++){
                if(data[i] == 0){
                    needIndexing.push( indexNewFaces(funcdata.facesdetected.FaceDetails[i]) ); //faces we need to store in our DB
                }
            }
            
            if(needIndexing.length > 0){
                console.log( needIndexing );
                return Promise.all( needIndexing );
            }
		        //start data/DB promises
        })
        .then(()=> {
		    funcdata.imgName = 'rekimagesmarius/' + path + '/img/' + name;
		    console.log( funcdata.imgName );
	        return putS3(img, name, 'rekimagesmarius/' + path  + '/img');

	    })
        .then(( )=>{
		    console.log("Doing DB");
            funcdata.bodypose = pose;

            var end =  new Date().getTime();
            funcdata.runtime =  (end - start)/1000;
            var insertSQL = 'insert into \"SNOWSTORE\".\"PUBLIC\".\"FACETRACKING\"(select parse_json (column1) from values(\'' + JSON.stringify(funcdata) + '\'))';
            return snowflake.runSQL(dbConn, insertSQL);
        })
		//return function all is well
        .then((data)=> {
		    console.log(data);
            resolve(funcdata);            
        })
        //catch block for errors
        .catch((error)=>{
            reject(error);
        });


    })//end promise

}//end crop faces function


function jimpCrop(faces, img){
    var clone;
    var croppedfaces = [];
    //var base64 = new Buffer(img.replace(/^data:image\/\w+;base64,/, ''),'base64');

    return new Promise((resolve, reject) => new jimp(img, (error, image) => {
        var w = image.bitmap.width;
        var h = image.bitmap.height;

        var functions = [];
        for(i=0; i< faces.length; i++){
            clone = image.clone().crop( w*faces[i].Left, 
                                        h*faces[i].Top, 
                                        w*faces[i].Width, 
                                        h*faces[i].Height);
            
            functions.push( clone.getBufferAsync(jimp.MIME_JPEG) );
        }

        Promise.all(functions)
        .then((data)=>{
            resolve (data);
        });
    }));


}


function detectFaces(image){
    var base64Img = new Buffer(image.replace(/^data:image\/\w+;base64,/, ''),'base64');

	var params = {
		Image: {
			Bytes: base64Img
		},
		Attributes: ["ALL"]
	};

    return new Promise((resolve, reject)=>{
        rekognition.detectFaces(params, function(err, data) {
            if (err){ 
                reject( error );
            }else{
                resolve( {img:base64Img, facedata:data} );
            }
        });
    })

}//end detect faces

function searchImage(img){
    var params = {
		CollectionId: 'public', 
		FaceMatchThreshold: 90, 
		Image: {Bytes: img.faceImg}, 
		MaxFaces: 1
    };

    return new Promise((resolve, reject)=>{
        rekognition.searchFacesByImage(params, function(error, data) {
            if (error){ 
                reject( error );
            }else{
                if(data.FaceMatches.length > 0){

                    var getSQL = "SELECT * FROM SNOWSTORE.PUBLIC.CUSTOMERS WHERE ID ='" + data.FaceMatches[0].Face.FaceId + "'";
                    return snowflake.getSQL(dbConn, getSQL)
                    .then((data)=>{
                        if(data.length > 0){
                            img.faceId = data[0].ID;
                            img.name = data[0].NAME;
                            img.faceImg = {}; // delete raw face image
                            resolve (1);
                        }else{
                            resolve(0);
                        }
                        
                    })
                }else{
                    resolve(0);
                }
                
            }
        })

    })

}


function indexNewFaces(newFace){
    var params = {
		CollectionId: 'public', 
		Image: {Bytes: newFace.faceImg}, 
	};

    return new Promise((resolve, reject)=>{
        rekognition.indexFaces(params, function(error, data) {
            if (error){ 
                reject( error );
            }else{
                if(data.FaceRecords.length > 0){
                    var saveCustSQL = "insert into SNOWSTORE.PUBLIC.CUSTOMERS (id, name) values ('" + data.FaceRecords[0].Face.FaceId + "', 'unk')";
                    return snowflake.runSQL(dbConn, saveCustSQL)
                    .then(()=>{
                        newFace.FaceId = data.FaceRecords[0].Face.FaceId;
                        newFace.name = 'unk';
                        newFace.faceImg = {}; // delete raw face image
                        resolve(1);
                    })

                }        
                resolve (0);

            }
        })
    })

}




//deprecated 
function putS3 (img, name, bucket) {
	console.log('Saving to S3');

	var data = {
		Bucket: bucket,
	  	Key: name, 
	  	Body: img
	};

	return new Promise(function(resolve, reject){
		s3.putObject(data, function (error, data) {
			if (error != null) {
				reject({status:'err', err:  error});
			} else { 
				resolve({status:'success', data: data.Body});
			}
		}//end func
	)});//end get obj

};




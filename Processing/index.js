const jimp = require('jimp');
const AWS = require('aws-sdk');
const config = require('./config.json');
const s3 = new AWS.S3(config.S3);
const rekognition = new AWS.Rekognition(config.rekognition)
const bucket = 'facetrackmarius';
var dyndb = new AWS.DynamoDB(config.dyndb);
var snowflake = require('snowflake-sdk');

var connection = snowflake.createConnection({
    account: config.snowflake.account,
    username: config.snowflake.username,
    password: config.snowflake.password
});

exports.handler = async (event) => {
    console.log(event.name, event.img, event.pose);

    return (event.name, event.img, event.pose);

    /*
    return cropFaces( event.Records[0].s3.object.key )
    .then((data)=>{
        console.log(JSON.stringify(data, null, 4) );
    }).catch((error)=>{
        console.log(error);
    });
    */
};

/*
return cropFaces( 'kidamarius4.jpg'  )
.then((data)=>{
    console.log(JSON.stringify(data, null, 4) );
    saveSnowflake(data);
    
}).catch((error)=>{
    console.log(error);
});
*/

 

function cropFaces(img){
    var funcdata = {};
    funcdata.imgName = img;
    var start =  new Date().getTime();
    var searched = [];

    return new Promise((resolve, reject)=>{
        s3.getObject({ Bucket: bucket, Key: img }, (error, s3data)=>{
            if(error){
                console.log(error);
            }else{

                // log into snowflake to insert data later
                connection.connect(function(err, conn) {
                    if (err) {
                        console.error('Unable to connect: ' + err.message);
                    } else {
                        console.log('Successfully connected as id: ' + connection.getId());
                    }
                });

                return detectFaces(s3data.Body).then((facedata)=>{ // Detect all faces in an image
                    var faces = [];
                    funcdata.facesdetected = facedata;
                    
                    function getFaceBoxes(){
                        for(i=0; i < facedata.FaceDetails.length; i++){
                            if(facedata.FaceDetails[i].Confidence > 95){
                                faces.push(facedata.FaceDetails[i].BoundingBox);
                            }
                        }
                    }//end function
                    getFaceBoxes();
                    return jimpCrop( faces, s3data.Body ); // crop all faces in image

                }).then((jimpCrop)=>{ 
                    var functions = [];
                    for(i=0; i < jimpCrop.length; i++){ //from all of the cropped images see if they are in our collection
                        funcdata.facesdetected.FaceDetails[i].faceImg = jimpCrop[i];
                        functions.push( searchImage( funcdata.facesdetected.FaceDetails[i]) );

                    }
                    return Promise.all(functions);
                    
                }).then((data)=>{
                    var needIndexing = [];
                    for(i=0; i < data.length; i++){
                        if(data[i] == 0){
                            needIndexing.push( indexNewFaces(funcdata.facesdetected.FaceDetails[i]) ); //faces we need to store in our DB
                        }
                    }
                    
                    if(needIndexing.length > 0){
                        return Promise.all( needIndexing );
                    }

                }).then(()=>{
                    var end =  new Date().getTime();
                    funcdata.runtime =  (end - start)/1000;
                    resolve(funcdata);

                })
                //catch block for errors
                .catch((error)=>{
                    reject(error);
                });


            }
        })
    })//end promise

}

function saveSnowflake(data){
    var snowflakeQuery = {
        sqlText: "insert into \"DEMO_DB\".\"PUBLIC\".\"FACETRACKING\"(select parse_json (column1) from values('" + JSON.stringify(data) + "'))",
        complete: function(err, stmt, rows){
            console.log(err, stmt, rows);
        }
    }
    
    connection.execute(snowflakeQuery);

}


//convert json to row data-- MAY NOT BE NEEDED. SNOWFLAKE HANDLES THIS
function convertJson(data){
    for(i=0; i < data.facesdetected.FaceDetails.length; i++){
        var f = data.facesdetected.FaceDetails[i];
        var output = [];
        //imgName, width, height, left, top, ageLow, ageHigh,smile,eyeglasses,sunglases,gender,beard,mustache,eyesOpen,mouthOpen,emotions, faceImg, faceId, Name
        output.push(f.BoundingBox.Width);
        output.push(f.BoundingBox.Height);
        output.push(f.BoundingBox.Left);
        output.push(f.BoundingBox.Top);
        
        return output.join(',');

    }
}


function jimpCrop(faces, img){
    var clone;
    var croppedfaces = [];

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
	var params = {
		Image: {
			Bytes: image
		},
		Attributes: ["ALL"]
	};

    return new Promise((resolve, reject)=>{
        rekognition.detectFaces(params, function(err, data) {
            if (err){ 
                reject( error );
            }else{
                resolve( data );
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
                    var key  = {id: { S: data.FaceMatches[0].Face.FaceId} }
                    return dynget( [key] )
                    .then((dbdata)=>{
                        var thisFace = img.faceImg;
                        img.FaceId = dbdata.Responses.faces[0].id.S;
                        img.name = dbdata.Responses.faces[0].name.S;
                        
                        var fileName = (new Date).getTime()+'.'+img.FaceId+'.jpg';
                        img.faceImg = fileName;

                        return putS3img(thisFace, fileName);
                    }).then(()=>{
                        resolve(1);
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
                    var putReq = [{ 
                        PutRequest: { 
                            Item: {
                                "id": { S: data.FaceRecords[0].Face.FaceId },
                                "name":{ "S" : 'unk' }
                            }
                        }
                    }]

                    return dynsave(putReq)
                    .then(()=>{
                        var thisFace = newFace.faceImg;

                        newFace.FaceId = data.FaceRecords[0].Face.FaceId;
                        newFace.name = 'unk';
                        var fileName = (new Date).getTime()+'.'+newFace.FaceId+'.jpg';
                        newFace.faceImg = fileName;

                        return putS3img(thisFace, fileName);
                    }).then(()=>{
                        resolve(1);
                    })

                }        
                resolve (0);

            }
        })
    })

}

function dynget(myKeys){
    var params = {
        RequestItems:{
            faces:{
                Keys: myKeys
            }
        }
    }
    
	return new Promise((resolve, reject) => {
        dyndb.batchGetItem(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve( data );
            }
        })
	});

}//end dyn get

function dynsave(myFaces){
    var params = {
        RequestItems:{
            faces: myFaces 
        }
    }

	return new Promise((resolve, reject) => {
        dyndb.batchWriteItem(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve( data );
            }
        })
	});

}//end dyn get

function putS3img (img, name){
	var data = {
		Bucket: 'rekimagesmarius',
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




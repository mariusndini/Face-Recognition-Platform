const jimp = require('jimp');
const AWS = require('aws-sdk');
const config = require('./config.json');
const s3 = new AWS.S3(config.S3);
const rekognition = new AWS.Rekognition(config.rekognition)
const bucket = 'facetrackmarius';
var dyndb = new AWS.DynamoDB(config.dyndb);
const snowflake = require('./snowflakeWrapper.js');

exports.handler = async (event) => {
    return cropFaces( event.img, event.pose)
    .then((data)=>{
        console.log(JSON.stringify(data, null, 4) );
    }).catch((error)=>{
        console.log(error);
    });
};

/*
var img = "data:image/jpeg;base64,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"
return cropFaces(img, {})
.then((data)=>{
    console.log(JSON.stringify(data, null, 4) );
}).catch((error)=>{
    console.log(error);
});
*/



function cropFaces(img, pose){
    var funcdata = {};
    funcdata.imgName = new Date().getTime() +'.'+ Math.round(Math.random()*1000000);
    var start =  new Date().getTime();
    var searched = [];

    return new Promise((resolve, reject)=>{
        return detectFaces(img).then((data)=>{ // Detect all faces in an image
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
            for(i=0; i < jimpCrop.length; i++){ //from all of the cropped images see if they are in our collection
                funcdata.facesdetected.FaceDetails[i].faceImg = jimpCrop[i];
                functions.push( searchImage( funcdata.facesdetected.FaceDetails[i]) );

            }
            return Promise.all(functions);
            
        })
        .then((data)=>{
            var needIndexing = [];
            for(i=0; i < data.length; i++){
                if(data[i] == 0){
                    needIndexing.push( indexNewFaces(funcdata.facesdetected.FaceDetails[i]) ); //faces we need to store in our DB
                }
            }
            
            if(needIndexing.length > 0){
                return Promise.all( needIndexing );
            }

        //start data/DB promises
        })
        .then(()=>{
            return snowflake.connect();            
        })
        .then((dbConn)=>{
            return snowflake.saveData(dbConn, funcdata);
        })
        .then(()=>{
            var end =  new Date().getTime();
            funcdata.runtime =  (end - start)/1000;
            funcdata.bodypose = pose;
            resolve(funcdata);            
        })
        //catch block for errors
        .catch((error)=>{
            reject(error);
        });


    })//end promise

}//end crop faces function

//convert json to row data-- MAY NOT BE NEEDED. SNOWFLAKE HANDLES THIS
/*
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
*/

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




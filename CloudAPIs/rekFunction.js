var func = {};
const config = require('./config.json');
var AWS = require('aws-sdk');
//const jimp = require('jimp');

var s3 = new AWS.S3(config.S3);
var dyndb = new AWS.DynamoDB(config.dyndb);

const rekognition = new AWS.Rekognition(config.rekognition);

func.putS3img = function(name, s3img){
	var buf = new Buffer(s3img.replace(/^data:image\/\w+;base64,/, ""),'base64');

	var data = {
		Bucket: config.S3.Bucket,
	  	Key: name, 
	  	Body: buf,
	  	ContentEncoding: 'base64',
	  	ContentType: 'image/jpeg',
	  
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




func.createCatelog = function(id){
	var params = {
		CollectionId: id
	};
	
	return new Promise(function(resolve, reject){
		rekognition.createCollection(params, function(err, data) {
			if (err){ 
				return reject({status: 'error', body: err });
			}else{
				return resolve({status: 'success', body: id});
			}
		});
	
	});

};


func.deleteCatelog = function(id){
	var params = {
		CollectionId: id
	};
	
	return new Promise(function(resolve, reject){
		rekognition.deleteCollection(params, function(err, data) {
			if (err){ 
				return reject({status: 'error', body: err});
			}else{
				return resolve({status: 'success', body: id});
			}
		});
	});

};


func.listCatelog = function(id){
	var params = {
		CollectionId: id, 
		MaxResults: 20
	};
	
	return new Promise(function(resolve, reject){
		rekognition.listFaces(params, function(err, data) {
			if (err){
				return reject({status: 'error', body: err });
			}else{
				return resolve({status: 'success', body: data });
			}
    
		});	    
	});


};


func.getS3img = function(s3img){
	return new Promise(function(resolve, reject){
		s3.getObject({ Bucket: config.S3.Bucket, Key: s3img },
		function (error, data) {
			if (error != null) {
				reject({status:'err', err:  error});
			} else { 
				resolve({status:'success', data: data.Body});
			}
		}//end func
	)});//end get obj

};// end get s3 image



func.detectText = function(params){
	
	console.log('start detecting text');
	return new Promise(function(resolve, reject){
		rekognition.detectText(params, function(err, data) {
			if (err){ 
				console.log({status:'errorDetectingText', err: err});
				reject({status:'error', err: err.stack});
			}else{
				console.log({status:'successDetectingText', data:data});
				resolve({status:'success', data: data});
			}
		});
	});

	
};

func.detectAllFaces = function(params){
	console.log('start detecting faces');
	return new Promise(function(resolve, reject){
		rekognition.detectFaces(params, function(err, data) {
			if (err){ 
				console.log({status:'errorDetectingFaces', err: err});
				reject({status:'error', err: err.stack});
			}else{
				console.log({status:'successDetectingFaces', data: data});
				resolve({status:'success', data: data});
			}
		});
	});

};// end detect all faces

/*
func.splitFaces = function (img, faces, name){
	console.log('5 Split Img Start');

	return new Promise (function(resolve, reject){
		console.log('6 Pre Jimp -> Start JIMP Promise');

		new jimp(img, (err, image)=>{
			console.log('7 Start JIMP Promise');
			var w = image.bitmap.width; 
			var h = image.bitmap.height;

			var clone; //
			var promises = [];

			var facesUpload = [];
			var f = faces.FaceDetails;

			for(i = 0; i < f.length; i++ ){
				console.log('8 In loop Faces - ' + i );
				clone = image.clone().crop(w*f[i].BoundingBox.Left, h*f[i].BoundingBox.Top, w*f[i].BoundingBox.Width, h*f[i].BoundingBox.Height);
				
				promises.push(clone.getBuffer(jimp.MIME_JPEG, (err, data)=>{
					console.log('9 JIMP Loop Promise');			
					facesUpload.push(data);
					
					var callback = function(error, data) { 
						if (error) {
							console.log('9.Err S3 Upload');
						} else {
							console.log('9 S3 Face Upload ');
						}
					};
					var imgName = 'faces/F'+i+'.' + name + '.T' + (new Date).getTime()+'.jpg';
					return s3.putObject({ Body: data, Key: imgName, Bucket: config.S3.Bucket}, callback);

					
				}));//end push

			}//end for


			Promise.all(promises)    
			.then(function(data){ 
				console.log('10 Jimp Promises resolve');
				resolve(facesUpload);

			})
			.catch(function(err){ 
				reject(err);
			});

		});
	});

}//end split faces
*/

func.searchByImage = function (img){
	var params = {
		CollectionId: 'test', 
		FaceMatchThreshold: 90, 
		Image: {
			Bytes: img
		}, 
		MaxFaces: 5
	};

	return new Promise(function(resolve, reject){
		rekognition.searchFacesByImage(params, function(err, data) {
			if (err){ 
				reject(data);
			}else{
				resolve(data);
			}
		});
	});

};//end search image


func.indexFaces = function(params){

	return new Promise(function(resolve, reject){
		rekognition.indexFaces(params, function(err, data) {
			if (err){ 
				console.log('Err Index Faces');
				reject(data);
			}else{
				console.log('Success Index Face');
				resolve(data);
			}
		});
	});

};//end index face

func.saveDBFace = function (data){
	var params = {
	  TableName: 'faces', 
	  Item: data
	  /* Item: {
	    "id": { S: "0" },
	    "name":{ "S" : "marius" },
	    "faces":{ "S" : "00-00-11-00" }
	  } */
	};

	return new Promise(function(resolve, reject){
		dyndb.putItem(params, function(err, data) {
		  if (err) {
			resolve( {status:'err', data: data} );
		  } else {
			resolve( {status:'success', data: data } );
		  }
		});	
	});
		
};//end save to db


func.searchFace = function(params){
	return new Promise(function(resolve, reject){
		rekognition.searchFacesByImage(params, function(err, data) {
			if (err){ 
				reject(data);
			}else{
				resolve(data);
			}
		});
	});
	
};

func.searchFaceById = function(params){
	return new Promise(function(resolve, reject){
		rekognition.searchFaces(params, function(err, data) {
			if (err){ 
				reject(data);
			}else{
				resolve(data);
			}
		});
	});
	
};

func.getDBFace = function (data){
	var params = {
	  TableName: 'faces', 
	  Key: data 
	  /*{
	    "id": { S: "02bedb93-15d1-4e2e-8523-4dd9045f2434" }
		}
		*/
	};

	return new Promise(function(resolve, reject){
		dyndb.getItem(params, function(err, data) {
		  if (err) {
			reject( {status:'err', data: data} );
		  } else {
		  	if(!(Object.keys(data).length === 0 && data.constructor === Object ) ){
		  		resolve( {status:'success', data: data.Item.name.S} );
		  	}else{
				resolve( {status:'complete', data: 'notfound'} );
		  	}
			
		  }
		});	
	});
		
};//end save to db


func.saveDBFace = function (data){
	var params = {
		TableName: 'faces', 
		Item: data 
		/*{
		"id": { S: "02bedb93-15d1-4e2e-8523-4dd9045f2434" }
		}
		*/
	};

	return new Promise(function(resolve, reject){
		dyndb.putItem(params, function(err, data) {
			if (err) {
				reject( {status:'err', data: err} );
			} else {
				resolve( {status:'success', data: data } );
			}
		});	
	});
		
};//end save to db





module.exports = func;
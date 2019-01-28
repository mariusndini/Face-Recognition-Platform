var AWS = require('aws-sdk');
const rek = require('./rekFunctions.js');
const catalog = 'public';

exports.handler = async (event) => {
	if(event.method == 'save') {
		return rek.putS3img(event.name, event.img)
		.then((data)=>{
			return data;
			
		}).catch((error)=>{
			console.log(error);
		});

	}
	
	
	if(event.method == 'listCatelog'){
		return rek.listCatelog(event.catalogId).then((data)=>{
			return {
				statusCode: 200,
				body: data,
			};    
		}).catch((error)=>{
			return {
				statusCode: 200,
				body: error,
			}; 
		});
	}
    
	//creating a catelog
	if(event.method == 'createCatelog'){
		return rek.createCatelog(event.catalogId).then((data)=>{
			return {
				statusCode: 200,
				body: data,
			};    
		}).catch((error)=>{
			return {
				statusCode: 200,
				body: error,
			}; 
		});
	}

	//delete a catelog
	if(event.method == 'deleteCatelog'){
		return rek.deleteCatelog(event.catalogId).then((data)=>{
			return {
				statusCode: 200,
				body: data,
			};    
		}).catch((error)=>{
			return {
				statusCode: 200,
				body: error,
			}; 
		});
	}	
	
//----------------------------------------------------------------------------------------------------------------------------------------	

	//detect all faces in an image
	if(event.method == 'detectFaces') {
		var image = new Buffer(event.img.replace(/^data:image\/\w+;base64,/, ''),'base64');
		
		var params = {
			Image: {  Bytes: image  },
			Attributes: ["DEFAULT"]
		};
		
		if(event.type == "ALL"){
			params.Attributes.push("ALL");
		}
		
		return rek.detectAllFaces(params).then((data)=>{
			return { 
				statusCode: 200,
				body: data
			}; 
		}).catch((error)=>{
			return {
				statusCode: 200,
				body: error,
			}; 
		});
	}//end detect faces


	//detect all text in an image
	if(event.method == 'detectText') {
		var image = new Buffer(event.img.replace(/^data:image\/\w+;base64,/, ''),'base64');

		var params = {
			Image: {
				Bytes: image
			}
		};
		
		return rek.detectText(params).then((data)=>{
			return { 
				statusCode: 200,
				body: data.data
			}; 
		}).catch((error)=>{
			return {
				statusCode: 200,
				body: error,
			}; 
		});
		
	}//end detect text

	//register face given an image
	if(event.method == 'registerFace') {
		var image = new Buffer(event.img.replace(/^data:image\/\w+;base64,/, ''),'base64');
	
		var params = {
			CollectionId: catalog, 
			FaceMatchThreshold: 90, 
			Image: {
				Bytes: image
			}, 
			MaxFaces: 1
		};
		
		var data = {};
		return rek.searchFace(params).then((faces)=>{
			data.faces = faces;
			var dbData = { 
				"id": { S: faces.FaceMatches[0].Face.FaceId },
				"name": {S: event.name}
			};
			
			return rek.saveDBFace( dbData );
		
		}).then((dbRek)=>{
			data.rec = dbRek;
			return { 
				statusCode: 200,
				body: data
			}; 
			
		}).catch((error)=>{
			console.log(error);
			
		});
		
	}//end detect text


	//detect all text in an image
	if(event.method == 'searchFace') {
		var image = new Buffer(event.img.replace(/^data:image\/\w+;base64,/, ''),'base64');
	
		var params = {
			CollectionId: catalog, 
			FaceMatchThreshold: 90, 
			Image: {
				Bytes: image
			}, 
			MaxFaces: 1
		};
		
		var data = {};
		return rek.searchFace(params).then((faces)=>{
			data.faces = faces;
			var dbData = { "id": { S: faces.FaceMatches[0].Face.FaceId } };
			return rek.getDBFace( dbData );
		
		}).then((dbRek)=>{
			data.rec = dbRek;
			return { 
				statusCode: 200,
				body: data
			}; 
			
		}).catch((error)=>{
			data.rec = {};
			data.rec.status = "notfound";
			return { 
				statusCode: 200,
				body: data
			};
			
		});
		
	}//end detect text
	
	
	
	if(event.method == 'searchFaceById') {
		var params = {
		   CollectionId: catalog,
		   FaceId: event.id,
		   FaceMatchThreshold: 90,
		   MaxFaces: 10
		};
		
		return rek.searchFaceById(params)
		.then((data)=>{
			return data;
			
		}).catch((error)=>{
			console.log(error);
		});
	}
	

	
	
	
};









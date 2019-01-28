# Face-Recognition-Platform
face rec platform

## Purpose 
In a store recognize a face as it traverses through the store.

## Overall Platform Goal
1) Create a platform to easy movement recording. Ability to record/save/upload dances, sports movement etc. http://densepose.org/ offers best way to do this so far.
2) Track Movements and facecial sentiment of customers in a retail environment.

### Face Location
Depending on camera position within a picture locate a person. 
These environments are already heavily camara'ed an advantage. 
They also already primarily focus on a specific area within an environment.
Someone can easily say "at the bottom half of this camera is Aisle 2. at the top half is Aisle 3".

### AWS Rekognition
AWS Rekognition is used to process face detection.

### Pose Estimation
Tensorflow openpose is used for this 
https://github.com/tensorlayer/openpose-plus

As the resolution gets better this data becomes more useful.
Capturing movements accruately at 60 fps or even 30 fps is useful for video. 
At 15 or 10 FPS its good for 2d games (even 3-7 FPS is good for 2D games).
2D can be made to look 3D.

### Identifying Objects
Easily identify objects in view
To simulate identify Letters or Text initially (Different Problem).

## Technical Details
Below outlines how this task is accomplished. Updates will be provided here.
Currently the cloud storage accepts picture uploads (s3).
Lamba function is tirggered, processing uploaded picture. 
Finally saving relavent data to database.
Data saved is face ID and name if known.

Pending: Pose estimation data


### Upload picture to Cloud Storage
Currently this is s3. Uploads are done through Post call and currently only accepts jpg/base64.
Postman -> API-Gateway -> Cloud Storage/s3

curl -X POST \
https://c4039mgor5.execute-api.us-east-2.amazonaws.com/dev/rec \
-H 'Content-Type: application/json' \
-H 'cache-control: no-cache' \
-d '{
   "method": "save",
   "name": "abcMariusTest",
   "img":"data:image/jpeg;base64"
}'

### Process Uploaded picture
Cloud Storage -> Process Image -> Database Save
1) Pull image from cloud storage. 
2) AWS Rekognition is used to detect all faces in an image. 
3) Jimp is then used to crop all images from the image. 
4) Each individual face is processed through AWS Rekogntion 'searchFacesByImage' function. Return result is place into two buckets 4.a) Recognized Face or 4.b) New Face. New faces are saved to AWS Dynabo DB with Face ID and default 'unk' name.
5) all images are saved to another bucket (individual faces only) tagged with time and faceID.
6) all data is saved to Database for later processing

### Data Processing







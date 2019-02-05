var snowflake = require('snowflake-sdk');
const config = require('./config.json');

var connection = snowflake.createConnection({
    account: config.snowflake.account,
    username: config.snowflake.username,
    password: config.snowflake.password
});

module.exports = {
    connect: function(){
        return new Promise((resolve, reject) =>{
            connection.connect(function(err, conn) {
                if (err) {
                    if(err.code == 405502){
                        resolve(connection);
                    }
                    console.log(JSON.stringify(err) );
                    reject(err);
                } else {
                    resolve (conn);
                }
            });
        })

    },

    saveData: function(dbConn, data){
        return new Promise((resolve, reject) =>{
            var snowflakeQuery = {
                sqlText: "insert into \"DEMO_DB\".\"PUBLIC\".\"FACETRACKING\"(select parse_json (column1) from values('" + JSON.stringify(data) + "'))",
                complete: function(err, stmt, rows){
                    if(err){
                        reject(err);
                    }
                    resolve(rows);
                }
            }
            dbConn.execute(snowflakeQuery);
        })  
    },
    disconnect: function(){
        return new Promise((resolve, reject)=>{
            connection.destroy(function(err, conn) {
                if (err) {
                    reject(0)
                }
                resolve(1);
            });
        })
    }

}





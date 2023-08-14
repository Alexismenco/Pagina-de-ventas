const { app } = require("./app");
const chalk = require("chalk");

app.listen(process.env.PORT || 3000,function(){
    console.log(chalk.red.inverse("*** servidor iniciado en puerto 3000 ***"));
});

const express = require('express');
const session = require('express-session');
const app = new express();
const WebpayPlus = require('transbank-sdk').WebpayPlus;
const { Options, IntegrationApiKeys, Environment, IntegrationCommerceCodes } = require("transbank-sdk");
const nodemailer=require('nodemailer');
require('dotenv').config();

// Configurar express-session
app.use(session({
  secret: 'mi-secreto-super-seguro', // Cambia esto por una cadena segura
  resave: false,
  saveUninitialized: true
}));

// configuracion nodmeailer (correo electronico)
var transporter=nodemailer.createTransport({
  service:'gmail',
  auth:{
    user:process.env.MAILUSER,
    pass:process.env.MAILPASS
  }
});

// configuracion server
app.use(express.urlencoded({extended:false}));
app.use(express.static('public'));
app.set('view engine',"ejs");
app.set("views",__dirname+"/views");

// Inicio
app.get('/', async (req,res) => {

  res.render('index');
});

// Compra
app.get('/buy', async (req,res) => {

  res.render('buy');
});

// Proceso de compra con transbank
app.post('/submit', async (req, res) => {

  // Conexion transbank
  IntegrationCommerceCodes.WEBPAY_PLUS = process.env.TBKAPIKEYID;
  IntegrationApiKeys.WEBPAY = process.env.TBKAPIKEYSECRET;

  let buyOrder = "O-" + Math.floor(Math.random() * 10000) + 1;
  let sessionId = "S-" + Math.floor(Math.random() * 10000) + 1;
  const monto = parseFloat(req.body.price);

  const tx = new WebpayPlus.Transaction(new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration));
  const response = await tx.create(buyOrder, sessionId, monto, process.env.DIRECCIONRETORNO);

  const token = response.token;
  const url = response.url;

  req.session.userData = {
    name: req.body.name,
    price: monto,
    quantity: req.body.quantity,
    address: req.body.address,
    email: req.body.email,
    orden: buyOrder,
    session: sessionId,
    number: req.body.numero
  };

  res.render('pagar',{ token, url, monto})
});

app.get('/pago', async (req, res) => {
    const userData = req.session.userData;

    let token = req.query.token_ws;
    let tbkToken = req.body.TBK_TOKEN;

  if (token && !tbkToken) {//Flujo 1 es exitosa
    const tx = new WebpayPlus.Transaction(new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration));
    const commitResponse = await tx.commit(token);

    if (commitResponse.status === 'AUTHORIZED') {
      // Email cliente
      const direccionRetorno = process.env.DIRECCIONRETORNO;
      const nuevaDireccion = direccionRetorno.replace('/pago', '/assets/cuidado-piel.pdf');
      
      const mensajeHTML = `
        <html>
          <body style="font-family: Arial, sans-serif;">
            <h2>¡Gracias por tu compra!</h2>
            <p>Estimado ${userData.name},</p>
            <p>Gracias por elegir nuestro Producto Increíble. Tu compra con N° de Orden ${userData.orden} ha sido exitosa.</p>
            <p>Detalles de la compra:</p>
            <ul>
              <li>Producto: Tu Producto Increíble</li>
              <li>Monto: $${userData.price}</li>
            </ul>
            <p>Esperamos que disfrutes de tu compra. Como agradecimiento, te regalamos un eBook de Cuidado de Piel.</p>
            <p><a href="${nuevaDireccion}" target="_blank" style="color: #e63c6d; text-decoration: none;">Descarga tu eBook aquí</a></p>
            <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
            <p>¡Gracias nuevamente!</p>
            <p>Atentamente,</p>
            <p>El Equipo de la Empresa</p>
          </body>
        </html>
      `;
      

      // Email encargado de sitio
      const mensajeEncargado = `
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Nueva Compra</h2>
                <p>Se ha realizado una nueva compra en el sitio.</p>
                <p>Detalles de la compra:</p>
                <ul>
                    <li>Producto: Tu Producto Increíble</li>
                    <li>Productos: $${userData.quantity}</li>

                    <li>Monto: $${userData.price}</li>
                </ul>
                <p>Detalles del usuario:</p>
                <ul>
                    <li>Nombre: ${userData.name}</li>
                    <li>Correo: ${userData.email}</li>
                    <li>Dirección: ${userData.address}</li>
                    <li>N° Celular: ${userData.number}</li>
                    <li>N° Orden: ${userData.orden}</li>
                    <li>N° Seción: ${userData.session}</li>
                </ul>
            </body>
            </html>
        `;
    
      const mail = {
        from: process.env.MAILUSER, // De la empresa
        to: userData.email, // Correo del comprador
        subject: '¡Compra Exitosa en Tu Producto Increíble!',
        html: mensajeHTML,
      };
    
      transporter.sendMail(mail, function (err, info) {
        if (err) {
          console.log("Error en el correo: " + err.message);
          res.status(500).send("Error al enviar correo");
        } else {
          console.log("Correo enviado: " + info.response);
        }
      });

      const mailEncargado = {
        from: process.env.MAILUSER, // De la empresa
        to: process.env.MAILENCARGADO, // Correo del encargado
        subject: '¡Compra Exitosa de un usuario!',
        html: mensajeEncargado,
      };
      transporter.sendMail(mailEncargado, function (err, info) {
        if (err) {
          console.log("Error en el correo: " + err.message);
          res.status(500).send("Error al enviar correo");
        } else {
          console.log("Correo enviado: " + info.response);
        }
      });
    
      res.render('successful');
    } 
    }else{//Flujo 2 si falla
      res.render('failed');
    }
});

module.exports={app}
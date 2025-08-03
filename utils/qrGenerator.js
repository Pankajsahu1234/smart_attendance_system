const QRCode = require('qrcode');
     const logger = require('./logger');

     const generateQRCode = async (data) => {
       try {
         const qrCodeUrl = await QRCode.toDataURL(data);
         logger.info(`Generated QR code for data: ${data}`);
         return qrCodeUrl;
       } catch (error) {
         logger.error(`Error generating QR code: ${error.message}`);
         throw error;
       }
     };

     module.exports = { generateQRCode };
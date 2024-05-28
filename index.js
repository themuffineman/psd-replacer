const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser');
const PSD = require('psd');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const sizeOf = require('image-size');
const path = require('path');

const PORT = 8080
const app = express()

app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors({
  origin: '*'
}))

const psdPath = './shirt_mockup.psd'

app.listen(PORT, ()=> {console.log(`Server is up on port ${PORT}`)})

app.post('/get-mockup', async (req,res)=>{
    console.log('Recieved request')
    try {
        const { base64Image } = req.body;
        const buffer = Buffer.from(base64Image, 'base64');
        const replacementImagePath = 'replacement_image.png';
        fs.writeFileSync(replacementImagePath, buffer);

        // Open the PSD file
        const psd = await PSD.open(psdPath);
        psd.parse();


        // Find the layer titled 'design_here'
        const layer = psd.tree().descendants().find(layer => layer.name === 'the_design');

        if (!layer) {
            return res.status(404).send('Layer with title "design_here" not found.');
        }
        console.log('Layer found yeyey!!')

        // Get the dimensions of the replacement image
        const dimensions = sizeOf(replacementImagePath);
        const width = dimensions.width;
        const height = dimensions.height;

        console.log('here are the dimens', width, height)

        // Load the replacement image
        const replacementImage = await loadImage(replacementImagePath);
        console.log('loaded the img')

        if (!layer.canvas) {
            console.error('Layer does not have a canvas.');
            return res.status(500).send('Layer does not have a canvas.');
        }

        // Create a canvas with the same dimensions as the layer to replace its content
        const canvas = createCanvas(layer.width, layer.height);
        const ctx = canvas.getContext('2d');

        // Draw the replacement image onto the canvas, fitting it to the layer's size
        ctx.drawImage(replacementImage, 0, 0, width, height, 0, 0, layer.width, layer.height);
        console.log('drew on the canvas')


        // Replace the layer's image data with the new image data
        const layerCtx = layer.canvas.getContext('2d');
        layerCtx.drawImage(canvas, 0, 0);
        console.log('replaced image yeyye!!')


        // Create a new canvas to render the final image
        const outputCanvas = createCanvas(psd.image.width(), psd.image.height());
        const outputCtx = outputCanvas.getContext('2d');

        console.log('rendered the final img almost there')


        // Draw each visible layer onto the output canvas
        psd.tree().descendants().forEach(layer => {
            if (layer.visible) {
                const image = layer.toPng();
                outputCtx.drawImage(image, layer.left, layer.top);
            }
        });

        console.log('finished drawing')


        // Convert the final canvas to a PNG buffer
        const finalImageBuffer = outputCanvas.toBuffer('image/png');
        console.log('converted to png buffer')


        // Send the final image as the response
        res.set('Content-Type', 'image/png');
        res.send(finalImageBuffer);

        // Clean up temporary files
        fs.unlinkSync(replacementImagePath);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Internal Server Error');
    }
})
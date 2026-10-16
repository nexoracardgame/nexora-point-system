import sharp from 'sharp';
await sharp('C:/Users/USER/Downloads/ced43c4a-b529-4c1e-aeaa-0056870ef2f6.png').webp({quality:95,alphaQuality:100}).toFile('public/images/lobby-play/play-button.webp');

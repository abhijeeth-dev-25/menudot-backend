const ImageKit = require('/Users/abhijeethkar/Desktop/menudot-backend/node_modules/imagekit');
const dotenv = require('/Users/abhijeethkar/Desktop/menudot-backend/node_modules/dotenv');

// Load env variables
dotenv.config({ path: '/Users/abhijeethkar/Desktop/menudot-backend/.env' });

console.log('--- STARTING IMAGEKIT CREDENTIALS VERIFICATION ---');
console.log('Public Key:', process.env.IMAGEKIT_PUBLIC_KEY);
console.log('URL Endpoint:', process.env.IMAGEKIT_URL_ENDPOINT);

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// A tiny 1x1 transparent PNG base64 string
const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testUpload() {
  try {
    console.log('Sending upload request to ImageKit...');
    const result = await imagekit.upload({
      file: base64Image,
      fileName: `menudot_verification_${Date.now()}.png`,
      folder: '/test_uploads',
    });

    console.log('✅ ImageKit Upload Success!');
    console.log('Uploaded File URL:', result.url);
    console.log('Uploaded File ID:', result.fileId);

    // Delete the test file to keep storage clean
    console.log('Deleting test file from ImageKit...');
    await imagekit.deleteFile(result.fileId);
    console.log('✅ Cleaned up successfully.');
    console.log('--- IMAGEKIT CREDENTIALS ARE 100% VALID AND WORKING ---');
  } catch (err) {
    console.error('❌ ImageKit Verification Failed:', err);
  }
}

testUpload();

/**
 * Script para crear credenciales S3-compatibles de Cloudflare R2 usando la API
 * 
 * Uso:
 * CLOUDFLARE_API_TOKEN=tu_token node scripts/create-r2-credentials.js
 */

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'CJnUpArGYo_7-jHmjqOqHprqXxrifNO7YGxWrwR_';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '37aa57c6afa868347f7349463923deb1';
const BUCKET_NAME = 'tiendita-images';
const JURISDICTION = 'default'; // o 'eu', etc. Para buckets sin jurisdicción específica es 'default'

async function createR2Credentials() {
  try {
    console.log('🚀 Creando credenciales S3-compatibles para R2...\n');
    console.log(`Account ID: ${CLOUDFLARE_ACCOUNT_ID}`);
    console.log(`Bucket: ${BUCKET_NAME}\n`);

    // Crear el token de API con permisos de R2
    const tokenResponse = await fetch(
      'https://api.cloudflare.com/client/v4/user/tokens',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'tiendita-r2-credentials',
          policies: [
            {
              effect: 'allow',
              resources: {
                [`com.cloudflare.edge.r2.bucket.${CLOUDFLARE_ACCOUNT_ID}_${JURISDICTION}_${BUCKET_NAME}`]: '*',
              },
              permission_groups: [
                {
                  id: 'bf7481a1826f439697cb59a20b22293e', // Workers R2 Storage Write
                },
              ],
            },
          ],
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('❌ Error al crear token:', JSON.stringify(error, null, 2));
      throw new Error(`Error: ${error.errors?.[0]?.message || 'Unknown error'}`);
    }

    const tokenData = await tokenResponse.json();
    
    if (tokenData.success && tokenData.result) {
      const tokenId = tokenData.result.id;
      const tokenValue = tokenData.result.value;
      
      console.log('✅ Token de API creado exitosamente!\n');
      console.log('═══════════════════════════════════════════════════════');
      console.log('⚠️  IMPORTANTE: Guarda estas credenciales de forma segura\n');
      console.log('Token ID (Access Key ID):');
      console.log(tokenId);
      console.log('\nToken Value (Secret Access Key - SHA-256):');
      console.log('Necesitas calcular el SHA-256 del token value');
      console.log('\nToken Value (para calcular SHA-256):');
      console.log(tokenValue);
      console.log('═══════════════════════════════════════════════════════\n');
      
      // Calcular SHA-256 del token value
      const crypto = await import('crypto');
      const secretAccessKey = crypto.createHash('sha256').update(tokenValue).digest('hex');
      
      console.log('✅ Credenciales S3-compatibles calculadas:\n');
      console.log('Access Key ID:');
      console.log(tokenId);
      console.log('\nSecret Access Key (SHA-256 del token):');
      console.log(secretAccessKey);
      console.log('\n═══════════════════════════════════════════════════════\n');
      
      console.log('Agrega estas variables a tu archivo .env:\n');
      console.log(`CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}`);
      console.log(`CLOUDFLARE_R2_ACCESS_KEY_ID=${tokenId}`);
      console.log(`CLOUDFLARE_R2_SECRET_ACCESS_KEY=${secretAccessKey}`);
      console.log('CLOUDFLARE_R2_BUCKET_NAME=tiendita-images');
      console.log('CLOUDFLARE_R2_PUBLIC_URL=https://pub-089390b52db2480a9984b5b5d37c53f7.r2.dev');
    } else {
      throw new Error('No se recibió respuesta válida del servidor');
    }
  } catch (error) {
    console.error('❌ Error al crear credenciales:', error.message);
    console.error('\nAsegúrate de que:');
    console.error('1. El token de API tenga permisos de "Workers R2 Storage" → "Edit"');
    console.error('2. El Account ID sea correcto');
    console.error('3. El bucket "tiendita-images" exista');
    process.exit(1);
  }
}

createR2Credentials();

import type { APIRoute } from 'astro';
import { EmailClient } from '../../lib/notifications/email';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const name = formData.get('name')?.toString();
    const email = formData.get('email')?.toString();
    const subject = formData.get('subject')?.toString();
    const message = formData.get('message')?.toString();

    // Validar campos requeridos
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Todos los campos son requeridos' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email inválido' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Intentar enviar email si está configurado
    const emailClient = new EmailClient();
    
    if (emailClient.isConfigured()) {
      const emailResult = await emailClient.send({
        to: import.meta.env.EMAIL_FROM_ADDRESS || 'hola@turni.pro',
        subject: `[Contacto] ${subject}`,
        html: `
          <h2>Nuevo mensaje de contacto</h2>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Asunto:</strong> ${subject}</p>
          <hr>
          <p><strong>Mensaje:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `,
        text: `
          Nuevo mensaje de contacto
          
          Nombre: ${name}
          Email: ${email}
          Asunto: ${subject}
          
          Mensaje:
          ${message}
        `,
      });

      if (!emailResult.success) {
        console.error('Error enviando email de contacto:', emailResult.error);
        // Continuar aunque falle el email, guardar en log
      }
    }

    // Por ahora, siempre retornar éxito (el email puede estar configurado o no)
    // En producción, podrías guardar en base de datos también
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensaje enviado correctamente. Te responderemos en menos de 24 horas.' 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error procesando formulario de contacto:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error al procesar el formulario. Por favor intentá nuevamente.' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

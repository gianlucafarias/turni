// =============================================================================
// API de Contacto
// Guarda los mensajes del formulario de contacto en la base de datos
// =============================================================================

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
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

    // Obtener IP y User-Agent del request
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Guardar en la base de datos
    const { data: contact, error: dbError } = await supabaseAdmin
      .from('contacts')
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
        status: 'new',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error guardando contacto en DB:', dbError);
      // Continuar aunque falle la DB, intentar enviar email
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
          ${contact ? `<p><small>ID: ${contact.id}</small></p>` : ''}
        `,
        text: `
          Nuevo mensaje de contacto
          
          Nombre: ${name}
          Email: ${email}
          Asunto: ${subject}
          
          Mensaje:
          ${message}
          ${contact ? `\nID: ${contact.id}` : ''}
        `,
      });

      if (!emailResult.success) {
        console.error('Error enviando email de contacto:', emailResult.error);
        // Continuar aunque falle el email
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensaje enviado correctamente. Te responderemos en menos de 24 horas.',
        contactId: contact?.id 
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

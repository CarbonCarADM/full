
import { Customer, Appointment } from "../types";

export const sendWhatsAppNotification = async (customer: Customer, appointment: Appointment) => {
  // Simulação de chamada de API (Twilio, Z-API, Evolution API, etc)
  console.log(`[WhatsApp API] Enviando notificação para ${customer.phone}...`);
  
  const message = `Olá ${customer.name}! 🚗✨\n\nÓtimas notícias: o serviço de *${appointment.serviceType}* no seu veículo já foi finalizado aqui na *CarbonCar*.\n\nSeu carro está pronto para ser retirado. Esperamos que tenha gostado do resultado!\n\nAté logo!`;

  // Em um ambiente real, aqui faríamos um fetch para o endpoint da API de WhatsApp
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`[WhatsApp API] Mensagem entregue: "${message.substring(0, 50)}..."`);
      resolve({ success: true, message: "Notificação enviada com sucesso!" });
    }, 1000);
  });
};

export const openWhatsAppChat = (phone: string, message: string) => {
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
};

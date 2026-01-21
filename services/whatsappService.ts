
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
  if (!phone) return;

  // Sanitize: Remove tudo que não é dígito
  let cleanPhone = phone.replace(/\D/g, '');

  // Garante o código do país (Brasil 55) se não houver
  if (cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`;
  }

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
};

export const generateConfirmationMessage = (
    businessName: string,
    customerName: string,
    appointmentDate: string,
    appointmentTime: string,
    vehicleModel: string,
    vehiclePlate: string,
    serviceName: string
): string => {
    const formattedDate = new Date(appointmentDate + 'T12:00:00').toLocaleDateString('pt-BR');
    
    return `Olá, ${customerName} 👋

Seu agendamento foi confirmado com sucesso.
Estamos aguardando a chegada do seu veículo na estética para iniciarmos o serviço no horário marcado.

Recomendamos chegar com 15 minutos de antecedência, para conferência rápida e melhor organização do atendimento.

📅 Data: ${formattedDate}
⏰ Horário: ${appointmentTime}
🚗 Veículo: ${vehicleModel || 'Veículo'} (${vehiclePlate || 'S/P'})
🛠 Serviço: ${serviceName || 'Serviço Geral'}

Qualquer imprevisto, por favor nos avise com antecedência.

Até breve!
— ${businessName}`;
};

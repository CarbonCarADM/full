
import { Customer, Appointment } from "../types";

export const sendWhatsAppNotification = async (customer: Customer, appointment: Appointment) => {
  // Simulação de chamada de API
  console.log(`[WhatsApp API] Enviando notificação para ${customer.phone}...`);
  return new Promise((resolve) => {
    setTimeout(() => {
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
    // Formata a data para dia/mês/ano
    const formattedDate = new Date(appointmentDate + 'T12:00:00').toLocaleDateString('pt-BR');
    
    return `Olá, ${customerName} 👋

Seu agendamento foi confirmado com sucesso.
Estamos aguardando a chegada do seu veículo na estética para iniciarmos o serviço no horário marcado.

Recomendamos chegar com 15 minutos de antecedência, para conferência rápida e melhor organização do atendimento.

📅 Data: ${formattedDate}
⏰ Horário: ${appointmentTime}
🚗 Veículo: ${vehicleModel || 'Veículo'} ${vehiclePlate ? `(${vehiclePlate})` : ''}
🛠 Serviço: ${serviceName || 'Serviço Geral'}

Qualquer imprevisto, por favor nos avise com antecedência.

Até breve!
— ${businessName}`;
};

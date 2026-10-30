// Quita espacios, guiones, puntos y paréntesis: "+52 (614) 123-4567" → "+526141234567".
export const normalizePhone = (value: string): string => value.replace(/[\s().-]/g, '');

// Enlace de WhatsApp: solo dígitos, sin "+".
export const whatsappUrl = (telefono: string): string =>
  `https://wa.me/${telefono.replace(/\D/g, '')}`;

/**
 * Centralized data sanitizer for MCP responses.
 * Strips credentials and masks PII before data reaches the AI agent.
 */

// --- Masking functions ---

export function maskCpf(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  // Show only last 2 digits of CPF: ***.***.**X-YZ → ***.***.***-YZ
  return `***.***.***-${digits.slice(-2)}`;
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

export function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}..${token.slice(-4)}`;
}

// --- P0: Credential stripping ---

export function stripCredentials<T extends Record<string, any>>(obj: T, fieldsToRemove: string[]): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  for (const field of fieldsToRemove) {
    if (field in result) {
      delete (result as any)[field];
    }
  }
  return result;
}

// --- P1: PII sanitization for common shapes ---

export function sanitizePayment<T extends Record<string, any>>(payment: T): T {
  if (!payment) return payment;
  return {
    ...payment,
    cpf: maskCpf(payment.cpf),
    phone: maskPhone(payment.phone),
    email: maskEmail(payment.email),
    emailFormatted: maskEmail(payment.emailFormatted),
    customerIp: undefined,
    address: payment.address ? sanitizeAddress(payment.address) : undefined,
    whatsappDeliveries: payment.whatsappDeliveries
      ? sanitizeWhatsappDeliveries(payment.whatsappDeliveries)
      : undefined,
  };
}

export function sanitizeAddress(address: any): any {
  if (!address) return null;
  return {
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
  };
}

export function sanitizeWhatsappDeliveries(deliveries: any): any {
  if (!deliveries) return deliveries;
  return {
    ...deliveries,
    items: deliveries.items?.map((item: any) => ({
      ...item,
      recipientPhone: maskPhone(item.recipientPhone),
    })),
  };
}

export function sanitizeLead<T extends Record<string, any>>(lead: T): T {
  if (!lead) return lead;
  return {
    ...lead,
    cpf: maskCpf(lead.cpf),
    phone: maskPhone(lead.phone),
    email: maskEmail(lead.email),
    ip: undefined,
    userAgent: undefined,
  };
}

export function sanitizeCustomer<T extends Record<string, any>>(customer: T): T {
  if (!customer) return customer;
  return {
    ...customer,
    cpf: maskCpf(customer.cpf),
    phone: maskPhone(customer.phone),
    email: maskEmail(customer.email),
  };
}

export function sanitizeFeedback<T extends Record<string, any>>(feedback: T): T {
  if (!feedback) return feedback;
  return {
    ...feedback,
    customerEmail: maskEmail(feedback.customerEmail),
  };
}

export function sanitizeStudent<T extends Record<string, any>>(student: T): T {
  if (!student) return student;
  return {
    ...student,
    email: maskEmail(student.email),
  };
}

export function sanitizeWebhook<T extends Record<string, any>>(webhook: T): T {
  if (!webhook) return webhook;
  return stripCredentials(webhook, ['secret']);
}

export function sanitizeGatewayToken<T extends Record<string, any>>(token: T): T {
  if (!token) return token;
  return {
    ...token,
    token: maskToken(token.token),
  };
}

export function sanitizeWhatsappSession<T extends Record<string, any>>(session: T): T {
  if (!session) return session;
  return stripCredentials(
    { ...session, phoneNumber: maskPhone(session.phoneNumber) },
    ['qrCode', 'workerUrl'],
  );
}

export function sanitizeWhatsappDelivery<T extends Record<string, any>>(delivery: T): T {
  if (!delivery) return delivery;
  return {
    ...delivery,
    recipientPhone: maskPhone(delivery.recipientPhone),
  };
}

export function sanitizeStoreConfig(config: any): any {
  if (!config) return config;
  const result = { ...config };
  if (result.paymentMethods) {
    result.paymentMethods = sanitizeStorePaymentMethods(result.paymentMethods);
  }
  return result;
}

export function sanitizeStorePaymentMethods(methods: any): any {
  if (!methods) return methods;
  const result = { ...methods };
  if (result.pix) result.pix = stripCredentials({ ...result.pix }, ['token']);
  if (result.credit_card) result.credit_card = stripCredentials({ ...result.credit_card }, ['token']);
  return result;
}

export function sanitizeFunnel(funnel: any): any {
  if (!funnel) return funnel;
  const result = { ...funnel };
  if (result.settings?.webhookSecret) {
    result.settings = { ...result.settings, webhookSecret: undefined };
  }
  return result;
}

export function sanitizeBillingCard(cardStatus: any): any {
  if (!cardStatus) return cardStatus;
  const result = { ...cardStatus };
  if (result.card) {
    result.card = stripCredentials({ ...result.card }, ['tokenId']);
  }
  return result;
}

export function sanitizePushDevice<T extends Record<string, any>>(device: T): T {
  if (!device) return device;
  return {
    ...device,
    token: maskToken(device.token),
    ipAddress: undefined,
  };
}

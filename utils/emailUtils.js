// Utility functions for email processing

export function isClientEmail(senderEmail, clientEmails) {
    if (!senderEmail || !clientEmails || clientEmails.length === 0) {
        return false;
    }
    
    const normalizedSender = senderEmail.toLowerCase().trim();
    return clientEmails.some(clientEmail => 
        clientEmail.toLowerCase().trim() === normalizedSender
    );
}

export function extractEmailFromString(text) {
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const matches = text.match(emailRegex);
    return matches ? matches[0] : null;
}

export function normalizeEmail(email) {
    return email ? email.toLowerCase().trim() : '';
}

export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function parseEmailHeader(headerValue) {
    // Extract email from "Name <email@domain.com>" format
    const emailMatch = headerValue.match(/<([^>]+)>/) || headerValue.match(/([^\s<>]+@[^\s<>]+)/);
    const nameMatch = headerValue.match(/^([^<]+)</);
    
    return {
        email: emailMatch ? emailMatch[1].trim() : '',
        name: nameMatch ? nameMatch[1].trim().replace(/"/g, '') : ''
    };
}
const crypto = require('crypto');

class InvoiceService {
  /**
   * Calculates GST breakdown (18% GST = 9% CGST + 9% SGST).
   */
  calculateGstBreakdown(totalAmount) {
    const amount = Number(totalAmount) || 0;
    // Base amount before 18% GST: Base = Total / 1.18
    const baseAmount = Math.round((amount / 1.18) * 100) / 100;
    const totalGst = Math.round((amount - baseAmount) * 100) / 100;
    const cgst = Math.round((totalGst / 2) * 100) / 100;
    const sgst = Math.round((totalGst / 2) * 100) / 100;

    return {
      baseAmount,
      totalGst,
      cgst,
      sgst,
      igst: 0,
      totalAmount,
    };
  }

  /**
   * Generates a unique GST Tax Invoice document payload.
   */
  generateTaxInvoice({ invoiceCategory, billTo, items, paymentId, totalAmount }) {
    const invoiceNumber = `INV-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const gstBreakdown = this.calculateGstBreakdown(totalAmount);

    return {
      invoiceNumber,
      invoiceDate: new Date(),
      invoiceCategory,
      issuer: {
        companyName: 'MenuDot Technologies Private Limited',
        gstin: '36AAACM1234F1Z9',
        pan: 'AAACM1234F',
        address: 'Hitec City, Madhapur, Hyderabad, Telangana 500081',
      },
      billTo: {
        name: billTo.name || 'Valued Customer',
        email: billTo.email || '',
        mobile: billTo.mobile || '',
        gstin: billTo.gstin || 'UNREGISTERED',
        address: billTo.address || 'India',
      },
      items: items.map((item) => ({
        description: item.description,
        hsnSac: item.hsnSac || '998313', // Information technology software services
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        taxableAmount: item.taxableAmount,
      })),
      pricing: gstBreakdown,
      paymentDetails: {
        paymentId,
        status: 'PAID',
        paidAt: new Date(),
      },
    };
  }
}

module.exports = new InvoiceService();

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import swaggerAutogen from 'swagger-autogen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputFile = path.join(__dirname, 'swagger-output.json');
const serverFile = path.join(__dirname, '..', '..', 'server.js');
const routesDir = path.join(__dirname, '..', 'routes');

const routeFiles = fs
  .readdirSync(routesDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => path.join(routesDir, file));

const useRoutesOnly = (process.env.SWAGGER_ROUTES_ONLY || 'false') === 'true';
const endpointsFiles = useRoutesOnly ? routeFiles : [serverFile, ...routeFiles];

const port = process.env.PORT || 3000;
const doc = {
  info: {
    title: 'GLY VTU API',
    description: 'Auto-generated Swagger specification for GLY VTU backend.',
  },
  tags: [
    { name: 'Auth', description: 'User authentication and session management.' },
    { name: 'User', description: 'User profile, KYC, and security settings.' },
    { name: 'Wallet', description: 'Wallet balance and transfers.' },
    { name: 'Bills', description: 'Bill categories, providers, quotes, and payments.' },
    { name: 'Transactions', description: 'User transaction history.' },
    { name: 'Banks', description: 'Bank list and account validation.' },
    { name: 'Admin Auth', description: 'Admin authentication and sessions.' },
    { name: 'Admin Users', description: 'Admin user management and KYC.' },
    { name: 'Admin Bills', description: 'Admin bills and pricing management.' },
    { name: 'Admin Transactions', description: 'Admin transaction reporting.' },
    { name: 'Admin Finance', description: 'Finance metrics and exports.' },
    { name: 'Admin Audit', description: 'Audit logs.' },
    { name: 'Admin Management', description: 'Admin roles and permissions.' },
    { name: 'Admin Monnify', description: 'Monnify event monitoring.' },
    { name: 'Monnify Webhook', description: 'Monnify webhook endpoint.' },
  ],
  host: process.env.SWAGGER_HOST || `localhost:${port}`,
  schemes: [process.env.SWAGGER_SCHEME || 'http'],
  basePath: '/',
  consumes: ['application/json'],
  produces: ['application/json'],
  securityDefinitions: {
    bearerAuth: {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      description: 'Use: `Bearer <token>`',
    },
  },
  definitions: {
    ErrorResponse: {
      type: 'object',
      properties: { error: { type: 'string', description: 'Error message' } },
      example: { error: 'Validation error' },
    },
    MessageResponse: {
      type: 'object',
      properties: { message: { type: 'string', description: 'Human-readable message' } },
      example: { message: 'Operation successful' },
    },
    AuthRegisterRequest: {
      type: 'object',
      required: ['fullName', 'email', 'phone', 'password'],
      properties: {
        fullName: { type: 'string', description: 'Full legal name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number (international format recommended)' },
        password: { type: 'string', description: 'Password (min 8 chars recommended)' },
        bvn: { type: 'string', description: 'Optional BVN for KYC level 1' },
        nin: { type: 'string', description: 'Optional NIN for KYC level 1' },
      },
      example: {
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '+2348012345678',
        password: 'StrongPassword1!',
        bvn: '12345678901',
      },
    },
    AuthLoginRequest: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', description: 'Email address' },
        password: { type: 'string', description: 'Password' },
        deviceId: { type: 'string', description: 'Client device identifier' },
      },
      example: { email: 'ada@example.com', password: 'StrongPassword1!', deviceId: 'device-xyz' },
    },
    AuthTokensResponse: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'JWT access token' },
        refreshToken: { type: 'string', description: 'Refresh token (may be null if cookie-based)' },
        csrfToken: { type: 'string', description: 'CSRF token for state-changing requests' },
      },
      example: {
        accessToken: 'eyJhbGciOi...',
        refreshToken: 'rft_12345',
        csrfToken: 'csrf_12345',
      },
    },
    AuthLoginResponse: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'JWT access token' },
        refreshToken: { type: 'string', description: 'Refresh token (may be null if cookie-based)' },
        csrfToken: { type: 'string', description: 'CSRF token for state-changing requests' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User ID' },
            fullName: { type: 'string', description: 'Full name' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
          },
        },
      },
      example: {
        accessToken: 'eyJhbGciOi...',
        refreshToken: 'rft_12345',
        csrfToken: 'csrf_12345',
        user: { id: 'uuid', fullName: 'Ada Lovelace', email: 'ada@example.com', phone: '+2348012345678' },
      },
    },
    AdminLoginResponse: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'JWT access token' },
        refreshToken: { type: 'string', description: 'Refresh token (may be null if cookie-based)' },
        csrfToken: { type: 'string', description: 'CSRF token for state-changing requests' },
        admin: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Admin ID' },
            name: { type: 'string', description: 'Admin name' },
            email: { type: 'string', description: 'Admin email' },
            role: { type: 'string', description: 'Admin role' },
          },
        },
      },
      example: {
        accessToken: 'eyJhbGciOi...',
        refreshToken: 'rft_admin_123',
        csrfToken: 'csrf_admin_123',
        admin: { id: 'uuid', name: 'Admin User', email: 'admin@example.com', role: 'super_admin' },
      },
    },
    RefreshRequest: {
      type: 'object',
      properties: { refreshToken: { type: 'string', description: 'Refresh token' } },
      example: { refreshToken: 'rft_12345' },
    },
    VerifyDeviceRequest: {
      type: 'object',
      required: ['email', 'code', 'deviceId'],
      properties: {
        email: { type: 'string', description: 'User email' },
        code: { type: 'string', description: 'OTP code' },
        deviceId: { type: 'string', description: 'Client device identifier' },
        label: { type: 'string', description: 'Friendly device name' },
      },
      example: { email: 'ada@example.com', code: '123456', deviceId: 'device-xyz', label: 'iPhone 14' },
    },
    ForgotPasswordRequest: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', description: 'Account email' } },
      example: { email: 'ada@example.com' },
    },
    ResetPasswordRequest: {
      type: 'object',
      required: ['email', 'code', 'newPassword'],
      properties: {
        email: { type: 'string', description: 'Account email' },
        code: { type: 'string', description: 'OTP code' },
        newPassword: { type: 'string', description: 'New password' },
      },
      example: { email: 'ada@example.com', code: '123456', newPassword: 'NewStrongPass1!' },
    },
    UserProfile: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'User ID' },
        full_name: { type: 'string', description: 'Full name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        kyc_level: { type: 'number', description: 'Current KYC level' },
        kyc_status: { type: 'string', description: 'KYC status', enum: ['pending', 'verified', 'rejected'] },
        kyc_payload: { type: 'string', description: 'Raw KYC payload JSON string' },
        account_number: { type: 'string', description: 'Reserved account number (if available)' },
        bank_name: { type: 'string', description: 'Reserved bank name (if available)' },
        account_name: { type: 'string', description: 'Reserved account name (if available)' },
      },
      example: {
        id: 'uuid',
        full_name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '+2348012345678',
        kyc_level: 1,
        kyc_status: 'pending',
        account_number: '0123456789',
        bank_name: 'Example Bank',
        account_name: 'Ada Lovelace',
      },
    },
    UpdateProfileRequest: {
      type: 'object',
      required: ['fullName', 'phone'],
      properties: {
        fullName: { type: 'string', description: 'Full name' },
        phone: { type: 'string', description: 'Phone number' },
      },
      example: { fullName: 'Ada Lovelace', phone: '+2348012345678' },
    },
    KycRequest: {
      type: 'object',
      required: ['level', 'payload'],
      properties: {
        level: { type: 'number', description: 'KYC level', enum: [1, 2] },
        payload: { type: 'object', description: 'KYC payload object' },
      },
      example: { level: 1, payload: { bvn: '12345678901' } },
    },
    PinSetupRequest: {
      type: 'object',
      required: ['pin'],
      properties: { pin: { type: 'string', description: '4-6 digit PIN' } },
      example: { pin: '1234' },
    },
    PinChangeRequest: {
      type: 'object',
      required: ['currentPin', 'newPin'],
      properties: {
        currentPin: { type: 'string', description: 'Current 4-6 digit PIN' },
        newPin: { type: 'string', description: 'New 4-6 digit PIN' },
      },
      example: { currentPin: '1234', newPin: '4321' },
    },
    PinVerifyRequest: {
      type: 'object',
      required: ['pin'],
      properties: { pin: { type: 'string', description: '4-6 digit PIN' } },
      example: { pin: '1234' },
    },
    BiometricRequest: {
      type: 'object',
      required: ['enabled'],
      properties: { enabled: { type: 'boolean', description: 'Enable or disable biometric auth' } },
      example: { enabled: true },
    },
    WalletBalance: {
      type: 'object',
      properties: {
        balance: { type: 'number', description: 'Wallet balance' },
        currency: { type: 'string', description: 'Currency code (e.g., NGN)' },
      },
      example: { balance: 12500.5, currency: 'NGN' },
    },
    WalletSendRequest: {
      type: 'object',
      required: ['amount', 'pin'],
      properties: {
        amount: { type: 'number', description: 'Transfer amount' },
        pin: { type: 'string', description: 'Transaction PIN' },
        channel: { type: 'string', description: 'Use `bank` for bank transfer.' },
        accountNumber: { type: 'string', description: 'Recipient account number (bank transfer)' },
        bankCode: { type: 'string', description: 'Bank code (bank transfer)' },
        accountName: { type: 'string', description: 'Recipient account name (bank transfer)' },
        to: { type: 'string', description: 'Recipient email or phone for internal transfer.' },
      },
      example: {
        amount: 5000,
        pin: '1234',
        channel: 'bank',
        accountNumber: '0123456789',
        bankCode: '058',
        accountName: 'Ada Lovelace',
      },
    },
    WalletSendResponse: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Result message' },
        reference: { type: 'string', description: 'Transfer reference' },
        status: { type: 'string', description: 'Transfer status', enum: ['pending', 'success'] },
      },
      example: { message: 'Transfer initiated', reference: 'TX-abc123', status: 'pending' },
    },
    WalletReceiveRequest: {
      type: 'object',
      required: ['amount'],
      properties: {
        amount: { type: 'number', description: 'Requested amount' },
        note: { type: 'string', description: 'Optional note for recipient' },
      },
      example: { amount: 1500, note: 'Lunch refund' },
    },
    WalletReceiveResponse: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Result message' },
        reference: { type: 'string', description: 'Request reference' },
      },
      example: { message: 'Money request created', reference: 'REQ-xyz123' },
    },
    BillsQuoteRequest: {
      type: 'object',
      required: ['providerCode', 'amount'],
      properties: {
        providerCode: { type: 'string', description: 'Bill provider code' },
        amount: { type: 'number', description: 'Bill amount' },
      },
      example: { providerCode: 'DSTV', amount: 5000 },
    },
    BillsPayRequest: {
      type: 'object',
      required: ['providerCode', 'amount', 'account', 'pin'],
      properties: {
        providerCode: { type: 'string', description: 'Bill provider code' },
        amount: { type: 'number', description: 'Bill amount' },
        account: { type: 'string', description: 'Service account/decoder number' },
        pin: { type: 'string', description: 'Transaction PIN' },
      },
      example: { providerCode: 'DSTV', amount: 5000, account: '1212121212', pin: '1234' },
    },
    BillsPayResponse: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Result message' },
        reference: { type: 'string', description: 'Bill reference' },
        total: { type: 'number', description: 'Total charged (amount + fee)' },
      },
      example: { message: 'Bill paid', reference: 'BILL-abc123', total: 5200 },
    },
    BankResolveRequest: {
      type: 'object',
      required: ['accountNumber'],
      properties: {
        accountNumber: { type: 'string', description: 'Account number to resolve' },
        bankCode: { type: 'string', description: 'Bank code (optional to fetch list)' },
      },
      example: { accountNumber: '0123456789', bankCode: '058' },
    },
    AdminCreateRequest: {
      type: 'object',
      required: ['name', 'email', 'password', 'role'],
      properties: {
        name: { type: 'string', description: 'Admin name' },
        email: { type: 'string', description: 'Admin email' },
        password: { type: 'string', description: 'Admin password' },
        role: { type: 'string', description: 'Admin role' },
      },
      example: { name: 'Admin User', email: 'admin@example.com', password: 'AdminPass1!', role: 'super_admin' },
    },
    AdminRoleUpdateRequest: {
      type: 'object',
      required: ['role'],
      properties: { role: { type: 'string', description: 'New role' } },
      example: { role: 'finance' },
    },
    AdminKycUpdateRequest: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', description: 'KYC status', enum: ['verified', 'rejected', 'pending'] },
        level: { type: 'number', description: 'KYC level', enum: [1, 2] },
      },
      example: { status: 'verified', level: 1 },
    },
    AdminBillsCategoryRequest: {
      type: 'object',
      required: ['code', 'name', 'description'],
      properties: {
        code: { type: 'string', description: 'Category code' },
        name: { type: 'string', description: 'Category name' },
        description: { type: 'string', description: 'Category description' },
      },
      example: { code: 'cable_tv', name: 'Cable TV', description: 'Cable TV subscriptions' },
    },
    AdminBillsCategoryUpdateRequest: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Category name' },
        description: { type: 'string', description: 'Category description' },
        active: { type: 'boolean', description: 'Activate or deactivate category' },
      },
      example: { name: 'Cable TV', description: 'Cable services', active: true },
    },
    AdminBillsProviderRequest: {
      type: 'object',
      required: ['categoryId', 'name', 'code'],
      properties: {
        categoryId: { type: 'string', description: 'Category ID' },
        name: { type: 'string', description: 'Provider name' },
        code: { type: 'string', description: 'Provider code' },
      },
      example: { categoryId: 'uuid', name: 'DSTV', code: 'DSTV' },
    },
    AdminBillsProviderUpdateRequest: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Provider name' },
        code: { type: 'string', description: 'Provider code' },
        active: { type: 'boolean', description: 'Activate or deactivate provider' },
      },
      example: { name: 'DSTV', code: 'DSTV', active: true },
    },
    AdminPricingRequest: {
      type: 'object',
      required: ['providerId'],
      properties: {
        providerId: { type: 'string', description: 'Provider ID' },
        baseFee: { type: 'number', description: 'Base fee amount' },
        markupType: { type: 'string', enum: ['flat', 'percent'], description: 'Markup calculation type' },
        markupValue: { type: 'number', description: 'Markup value' },
        currency: { type: 'string', description: 'Currency code (e.g., NGN)' },
      },
      example: { providerId: 'uuid', baseFee: 50, markupType: 'percent', markupValue: 1.5, currency: 'NGN' },
    },
    AdminPricingUpdateRequest: {
      type: 'object',
      properties: {
        baseFee: { type: 'number', description: 'Base fee amount' },
        markupType: { type: 'string', enum: ['flat', 'percent'], description: 'Markup calculation type' },
        markupValue: { type: 'number', description: 'Markup value' },
        currency: { type: 'string', description: 'Currency code (e.g., NGN)' },
        active: { type: 'boolean', description: 'Activate or deactivate pricing rule' },
      },
      example: { baseFee: 20, markupType: 'flat', markupValue: 10, currency: 'NGN', active: true },
    },
    AdminMonnifyRetryRequest: {
      type: 'object',
      required: ['paymentReference'],
      properties: { paymentReference: { type: 'string', description: 'Monnify payment reference' } },
      example: { paymentReference: 'MNFY-123456' },
    },
    Bank: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        code: { type: 'string' },
        active: { type: 'number' },
      },
      example: { id: 'uuid', name: 'Access Bank', code: '044', active: 1 },
    },
    TransactionItem: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string', description: 'Transaction type' },
        amount: { type: 'number' },
        fee: { type: 'number' },
        total: { type: 'number' },
        status: { type: 'string', enum: ['pending', 'success', 'failed'] },
        reference: { type: 'string' },
        created_at: { type: 'string' },
      },
      example: {
        id: 'uuid',
        type: 'send',
        amount: 5000,
        fee: 0,
        total: 5000,
        status: 'success',
        reference: 'TX-abc123',
        created_at: '2026-03-27T10:00:00Z',
      },
    },
    BillCategory: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        code: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        active: { type: 'number' },
      },
      example: { id: 'uuid', code: 'cable_tv', name: 'Cable TV', description: 'Cable services', active: 1 },
    },
    BillProvider: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        code: { type: 'string' },
        active: { type: 'number' },
        category_name: { type: 'string' },
        category_code: { type: 'string' },
      },
      example: { id: 'uuid', name: 'DSTV', code: 'DSTV', active: 1, category_name: 'Cable TV' },
    },
    BillQuoteResponse: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        amount: { type: 'number' },
        fee: { type: 'number' },
        total: { type: 'number' },
        currency: { type: 'string' },
      },
      example: { provider: 'DSTV', amount: 5000, fee: 50, total: 5050, currency: 'NGN' },
    },
    AdminUser: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string' },
        created_at: { type: 'string' },
      },
      example: { id: 'uuid', name: 'Admin User', email: 'admin@example.com', role: 'super_admin' },
    },
    AdminUserListItem: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        full_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        kyc_level: { type: 'number' },
        kyc_status: { type: 'string', enum: ['pending', 'verified', 'rejected'] },
        created_at: { type: 'string' },
      },
      example: {
        id: 'uuid',
        full_name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '+2348012345678',
        kyc_level: 1,
        kyc_status: 'pending',
        created_at: '2026-03-27T10:00:00Z',
      },
    },
    AuditLog: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        actor_type: { type: 'string' },
        actor_id: { type: 'string' },
        action: { type: 'string' },
        entity_type: { type: 'string' },
        entity_id: { type: 'string' },
        ip_address: { type: 'string' },
        user_agent: { type: 'string' },
        metadata: { type: 'object' },
        created_at: { type: 'string' },
      },
      example: {
        id: 'uuid',
        actor_type: 'admin',
        actor_id: 'uuid',
        action: 'admin.login',
        entity_type: 'admin',
        entity_id: 'uuid',
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        metadata: {},
        created_at: '2026-03-27T10:00:00Z',
      },
    },
    MonnifyEvent: {
      type: 'object',
      properties: {
        payment_reference: { type: 'string' },
        account_reference: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string' },
        paid_on: { type: 'string' },
        status: { type: 'string', enum: ['received', 'success', 'failed'] },
        attempts: { type: 'number' },
        last_error: { type: 'string' },
        updated_at: { type: 'string' },
      },
      example: {
        payment_reference: 'MNFY-123456',
        account_reference: 'GLY-uuid',
        amount: 2000,
        currency: 'NGN',
        paid_on: '2026-03-27T10:00:00Z',
        status: 'success',
        attempts: 1,
        last_error: null,
        updated_at: '2026-03-27T10:00:00Z',
      },
    },
    FinanceOverview: {
      type: 'object',
      properties: {
        users: { type: 'number' },
        volume: { type: 'number' },
        revenue: { type: 'number' },
        credits: { type: 'number' },
        debits: { type: 'number' },
        walletBalance: { type: 'number' },
      },
      example: { users: 120, volume: 500000, revenue: 12000, credits: 250000, debits: 230000, walletBalance: 45000 },
    },
    WalletBalanceRow: {
      type: 'object',
      properties: {
        full_name: { type: 'string' },
        email: { type: 'string' },
        balance: { type: 'number' },
        currency: { type: 'string' },
        updated_at: { type: 'string' },
      },
      example: { full_name: 'Ada Lovelace', email: 'ada@example.com', balance: 1200, currency: 'NGN', updated_at: '2026-03-27T10:00:00Z' },
    },
    AdminTransaction: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        full_name: { type: 'string' },
        type: { type: 'string' },
        amount: { type: 'number' },
        fee: { type: 'number' },
        total: { type: 'number' },
        status: { type: 'string', enum: ['pending', 'success', 'failed'] },
        reference: { type: 'string' },
        created_at: { type: 'string' },
      },
      example: {
        id: 'uuid',
        full_name: 'Ada Lovelace',
        type: 'bill',
        amount: 5000,
        fee: 50,
        total: 5050,
        status: 'success',
        reference: 'BILL-abc123',
        created_at: '2026-03-27T10:00:00Z',
      },
    },
  },
};

export async function generateSwagger() {
  const swagger = swaggerAutogen({ openapi: '2.0' });
  const result = await swagger(outputFile, endpointsFiles, doc);
  if (!fs.existsSync(outputFile)) {
    console.warn('swagger-autogen did not generate output file. Falling back to manual builder.');
    const fallback = buildFallbackSpec();
    fs.writeFileSync(outputFile, JSON.stringify(fallback, null, 2));
  }
  return outputFile;
}

function buildFallbackSpec() {
  const rootDir = path.resolve(__dirname, '..', '..');
  const serverPath = path.join(rootDir, 'server.js');
  const serverSource = fs.readFileSync(serverPath, 'utf-8');

  const importMap = new Map();
  const importRegex = /import\s+([A-Za-z0-9_]+)\s+from\s+['"]([^'"]+)['"]/g;
  let match = null;
  while ((match = importRegex.exec(serverSource)) !== null) {
    const varName = match[1];
    const relPath = match[2];
    if (!relPath.includes('routes')) continue;
    const absPath = path.resolve(rootDir, relPath);
    importMap.set(varName, absPath);
  }

  const useRegex = /app\.use\(([^)]+)\)/g;
  const mountPoints = [];
  while ((match = useRegex.exec(serverSource)) !== null) {
    const args = match[1]
      .split(',')
      .map((arg) => arg.trim())
      .filter((arg) => arg.length > 0);
    if (!args.length) continue;
    const basePathRaw = args[0];
    if (!basePathRaw.startsWith("'") && !basePathRaw.startsWith('"') && !basePathRaw.startsWith('`')) {
      continue;
    }
    const basePath = basePathRaw.slice(1, -1);
    const lastArg = args[args.length - 1];
    const routeVar = lastArg.replace(/\);?$/, '');
    const routeFile = importMap.get(routeVar);
    if (routeFile) {
      mountPoints.push({ basePath, routeFile });
    }
  }

  const tagByPrefix = {
    '/api/auth': 'Auth',
    '/api/user': 'User',
    '/api/wallet': 'Wallet',
    '/api/bills': 'Bills',
    '/api/transactions': 'Transactions',
    '/api/banks': 'Banks',
    '/api/admin/auth': 'Admin Auth',
    '/api/admin/users': 'Admin Users',
    '/api/admin/bills': 'Admin Bills',
    '/api/admin/transactions': 'Admin Transactions',
    '/api/admin/manage': 'Admin Management',
    '/api/admin/audit': 'Admin Audit',
    '/api/admin/finance': 'Admin Finance',
    '/api/monnify/webhook': 'Monnify Webhook',
    '/api/admin/monnify': 'Admin Monnify',
  };

  const paths = {};
  const methodRegex = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  for (const { basePath, routeFile } of mountPoints) {
    if (!fs.existsSync(routeFile)) continue;
    const source = fs.readFileSync(routeFile, 'utf-8');
    let m = null;
    while ((m = methodRegex.exec(source)) !== null) {
      const method = m[1].toLowerCase();
      const routePath = m[2];
      const fullPath =
        routePath === '/'
          ? basePath
          : basePath.endsWith('/')
            ? `${basePath}${routePath.replace(/^\//, '')}`
            : `${basePath}${routePath.startsWith('/') ? '' : '/'}${routePath}`;
      if (!paths[fullPath]) paths[fullPath] = {};
      const tag = tagByPrefix[basePath] || 'API';
      paths[fullPath][method] = {
        tags: [tag],
        summary: `${method.toUpperCase()} ${fullPath}`,
        responses: {
          200: { description: 'Success' },
        },
      };
    }
  }

  return {
    ...doc,
    paths,
  };
}

if (process.argv[1] && process.argv[1].endsWith('swagger.js')) {
  generateSwagger()
    .then(() => {
      console.log(`Swagger docs generated at ${outputFile}`);
    })
    .catch((err) => {
      console.error('Swagger generation failed:', err);
      process.exit(1);
    });
}

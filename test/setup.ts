process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '4000';
process.env.DATABASE_URL ??= 'postgresql://USER:PASSWORD@localhost:5432/ecommerce';
process.env.DIRECT_URL ??= 'postgresql://USER:PASSWORD@localhost:5432/ecommerce';
process.env.STOREFRONT_URL ??= 'http://localhost:3000';
process.env.ADMIN_URL ??= 'http://localhost:3001';
process.env.SWAGGER_ENABLED ??= 'false';

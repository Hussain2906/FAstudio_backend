import Joi from 'joi';

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4000),
  TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
  TRUST_RAILWAY_REAL_IP: Joi.boolean().truthy('true').falsy('false').default(false),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  DIRECT_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  STOREFRONT_URL: Joi.string().uri().default('http://localhost:3000'),
  ADMIN_URL: Joi.string().uri().default('http://localhost:3001'),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  CLOUDINARY_URL: Joi.string().uri({ scheme: ['cloudinary'] }).required(),
  CLOUDINARY_FOLDER: Joi.string().default('interior-portfolio/'),
  CLOUDINARY_MAX_UPLOAD_BYTES: Joi.number().integer().positive().max(10485760).default(10485760),
  AUTH_SESSION_TTL_SECONDS: Joi.number().integer().positive().default(28800),
  AUTH_SESSION_COOKIE_NAME: Joi.string().default('fs_admin_session'),
  CONTACT_SMTP_ENCRYPTION_KEY: Joi.string()
    .pattern(/^[a-fA-F0-9]{64}$/)
    .allow('')
    .optional(),
});

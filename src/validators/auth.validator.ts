import { body } from 'express-validator';

const email = () => body('email').isEmail().withMessage('Correo electrónico inválido').normalizeEmail({ gmail_remove_dots: false });

const newPassword = (field: string) =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage('La contraseña debe tener entre 8 y 72 caracteres')
    .matches(/[A-Za-z]/)
    .withMessage('La contraseña debe incluir al menos una letra')
    .matches(/\d/)
    .withMessage('La contraseña debe incluir al menos un número');

const displayName = (field: string) =>
  body(field).optional().isString().trim().isLength({ min: 2, max: 60 }).withMessage('El nombre debe tener entre 2 y 60 caracteres');

export const signupValidator = [
  email(),
  newPassword('password'),
  // `displayName` is the older field name; either one is accepted
  displayName('name'),
  displayName('displayName'),
  body().custom((value) => Boolean(value?.name || value?.displayName)).withMessage('El nombre es obligatorio'),
];

export const loginValidator = [
  email(),
  body('password').isString().notEmpty().withMessage('La contraseña es obligatoria'),
];

export const refreshValidator = [body('refreshToken').isString().notEmpty().withMessage('refreshToken es obligatorio')];

export const googleValidator = [body('token').isString().notEmpty().withMessage('token es obligatorio')];

export const updateProfileValidator = [
  displayName('name'),
  body('email').optional().isEmail().withMessage('Correo electrónico inválido').normalizeEmail({ gmail_remove_dots: false }),
];

export const changePasswordValidator = [
  body('currentPassword').isString().notEmpty().withMessage('La contraseña actual es obligatoria'),
  newPassword('newPassword'),
];

export const deleteAccountValidator = [
  body('password').optional().isString(),
  body('email').optional().isString(),
];

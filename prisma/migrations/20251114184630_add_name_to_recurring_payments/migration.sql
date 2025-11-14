/*
  Warnings:

  - Added the required column `name` to the `recurring_payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Primero agregamos la columna con un valor por defecto
ALTER TABLE `recurring_payments` ADD COLUMN `name` VARCHAR(191) NOT NULL DEFAULT 'Pago Recurrente';

-- Actualizar registros existentes para usar la descripción como nombre (si existe)
UPDATE `recurring_payments` SET `name` = `description` WHERE `name` = 'Pago Recurrente';

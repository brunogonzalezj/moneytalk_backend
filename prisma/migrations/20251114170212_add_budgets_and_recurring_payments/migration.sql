-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `recurringPaymentId` INTEGER NULL;

-- CreateTable
CREATE TABLE `budgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `period` ENUM('WEEKLY', 'MONTHLY', 'YEARLY') NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `budgets_userId_idx`(`userId`),
    INDEX `budgets_categoryId_idx`(`categoryId`),
    INDEX `budgets_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recurring_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `frequency` ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY') NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `nextDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `recurring_payments_userId_idx`(`userId`),
    INDEX `recurring_payments_categoryId_idx`(`categoryId`),
    INDEX `recurring_payments_nextDate_idx`(`nextDate`),
    INDEX `recurring_payments_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `transactions_recurringPaymentId_idx` ON `transactions`(`recurringPaymentId`);

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_recurringPaymentId_fkey` FOREIGN KEY (`recurringPaymentId`) REFERENCES `recurring_payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_payments` ADD CONSTRAINT `recurring_payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_payments` ADD CONSTRAINT `recurring_payments_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

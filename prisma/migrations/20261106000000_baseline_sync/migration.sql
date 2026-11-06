-- Brings the migration history in line with the schema that was applied with `db push`.
-- Existing databases: mark as applied with `prisma migrate resolve --applied 20261106000000_baseline_sync`.

-- DropForeignKey
ALTER TABLE `budgets` DROP FOREIGN KEY `budgets_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `budgets` DROP FOREIGN KEY `budgets_userId_fkey`;

-- DropIndex
DROP INDEX `categories_name_key` ON `categories`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `avatar` VARCHAR(191) NULL,
    ADD COLUMN `notificationSettings` JSON NULL,
    ADD COLUMN `notificationSubscription` JSON NULL,
    ADD COLUMN `provider` VARCHAR(191) NOT NULL DEFAULT 'email',
    ADD COLUMN `providerId` VARCHAR(191) NULL,
    MODIFY `passwordHash` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `budgets`;

-- CreateTable
CREATE TABLE `savings_goals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL DEFAULT '',
    `type` ENUM('SAVINGS_GOAL', 'PURCHASE_GOAL', 'EMERGENCY_FUND', 'VACATION', 'OTHER') NOT NULL,
    `targetAmount` DECIMAL(10, 2) NOT NULL,
    `currentAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `targetDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `savings_goals_userId_idx`(`userId`),
    INDEX `savings_goals_status_idx`(`status`),
    INDEX `savings_goals_targetDate_idx`(`targetDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `categories_name_type_key` ON `categories`(`name`, `type`);

-- AddForeignKey
ALTER TABLE `savings_goals` ADD CONSTRAINT `savings_goals_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


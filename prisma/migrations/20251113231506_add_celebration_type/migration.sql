/*
  Warnings:

  - You are about to drop the column `status` on the `schedule` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `schedule` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `schedule` table. All the data in the column will be lost.
  - Added the required column `celebrationTypeId` to the `Schedule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time` to the `Schedule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `schedule` DROP COLUMN `status`,
    DROP COLUMN `type`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `celebrationTypeId` INTEGER NOT NULL,
    ADD COLUMN `time` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `CelebrationType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL DEFAULT '#2196f3',
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `CelebrationType_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Schedule` ADD CONSTRAINT `Schedule_celebrationTypeId_fkey` FOREIGN KEY (`celebrationTypeId`) REFERENCES `CelebrationType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

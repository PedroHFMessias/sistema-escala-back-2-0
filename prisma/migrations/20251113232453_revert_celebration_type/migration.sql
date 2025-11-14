/*
  Warnings:

  - You are about to drop the column `celebrationTypeId` on the `schedule` table. All the data in the column will be lost.
  - You are about to drop the `celebrationtype` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `type` to the `Schedule` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `schedule` DROP FOREIGN KEY `Schedule_celebrationTypeId_fkey`;

-- DropIndex
DROP INDEX `Schedule_celebrationTypeId_fkey` ON `schedule`;

-- AlterTable
ALTER TABLE `schedule` DROP COLUMN `celebrationTypeId`,
    ADD COLUMN `type` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `celebrationtype`;

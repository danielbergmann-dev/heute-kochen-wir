import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const cookingDays = sqliteTable('cooking_days', { id: text('id').primaryKey(), classId: text('class_id').notNull(), date: text('date').notNull(), dish: text('dish').notNull().default(''), answers: text('answers').notNull(), version: integer('version').notNull().default(1) });

export const accessAttempts=sqliteTable('access_attempts',{id:text('id').primaryKey(),attempts:integer('attempts').notNull(),expires:integer('expires').notNull()});

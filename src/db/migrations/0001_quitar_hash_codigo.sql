-- Los códigos hasheados no se pueden convertir al formato cifrado: se descartan las familias de prueba existentes.
DELETE FROM "recetario"."household";--> statement-breakpoint
ALTER TABLE "recetario"."household" DROP COLUMN "access_code_hash";
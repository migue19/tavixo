-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cardAmountCents" INTEGER,
ADD COLUMN     "cashAmountCents" INTEGER;

UPDATE "Payment" SET "cashAmountCents"=CASE WHEN method='CASH' THEN "amountCents" ELSE 0 END,"cardAmountCents"=CASE WHEN method='CARD' THEN "amountCents" ELSE 0 END;
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_method_check";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_method_check" CHECK ((method='CASH' AND reference='') OR (method='CARD' AND "receivedCents"="amountCents" AND length(trim(reference)) BETWEEN 1 AND 80) OR (method='MIXED' AND "cashAmountCents" IS NOT NULL AND "cardAmountCents" IS NOT NULL AND "cashAmountCents">0 AND "cardAmountCents">0 AND "cashAmountCents"::bigint+"cardAmountCents"::bigint="amountCents" AND length(trim(reference)) BETWEEN 1 AND 80));
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_split_check" CHECK ((method='CASH' AND ("cashAmountCents" IS NULL OR "cashAmountCents"="amountCents") AND ("cardAmountCents" IS NULL OR "cardAmountCents"=0)) OR (method='CARD' AND ("cardAmountCents" IS NULL OR "cardAmountCents"="amountCents") AND ("cashAmountCents" IS NULL OR "cashAmountCents"=0)) OR method='MIXED');

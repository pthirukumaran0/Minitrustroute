import { z } from 'zod';

export const TransactionSignalsInputSchema = z.object({
  simSwap24h: z.boolean({
    message: 'simSwap24h signal is required (boolean)',
  }),
  numberVerified: z.boolean({
    message: 'numberVerified signal is required (boolean)',
  }),
  deviceStatus: z
    .string({
      message: 'deviceStatus is required (e.g. TRUSTED, SUSPICIOUS, UNKNOWN)',
    })
    .min(1)
    .default('UNKNOWN'),
});

export const CreateTransactionInputSchema = z.object({
  transactionId: z
    .string()
    .min(3, 'transactionId must have at least 3 characters')
    .optional(),
  amount: z
    .number({
      message: 'amount is required and must be a positive number',
    })
    .positive('amount must be greater than 0'),
  currency: z
    .string({
      message: 'currency is required',
    })
    .length(3, 'currency code must be exactly 3 uppercase letters (e.g. USD, EUR, INR)')
    .transform((val) => val.toUpperCase()),
  sourceCountry: z
    .string({
      message: 'sourceCountry is required',
    })
    .min(2, 'sourceCountry must be at least 2 characters'),
  destinationCountry: z
    .string({
      message: 'destinationCountry is required',
    })
    .min(2, 'destinationCountry must be at least 2 characters'),
  signals: TransactionSignalsInputSchema,
  sourceProviderId: z.string().optional(),
  destinationProviderId: z.string().optional(),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>;

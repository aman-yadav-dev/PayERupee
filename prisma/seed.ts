import { PrismaClient, LedgerAccountType, Currency } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new Pool({ connectionString: process.env.DIRECT_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding development database...')

  // 1. Seed System Transit Account
  const existingTransit = await prisma.ledgerAccount.findFirst({
    where: {
      merchantProfileId: null,
      type: LedgerAccountType.SYSTEM_TRANSIT,
      currency: Currency.INR,
    }
  })

  if (!existingTransit) {
    await prisma.ledgerAccount.create({
      data: {
        merchantProfileId: null,
        type: LedgerAccountType.SYSTEM_TRANSIT,
        currency: Currency.INR,
        isActive: true,
      }
    })
    console.log('Created SYSTEM_TRANSIT INR account.')
  } else {
    console.log('SYSTEM_TRANSIT INR account already exists.')
  }

  // 2. Seed System Revenue Account
  const existingRevenue = await prisma.ledgerAccount.findFirst({
    where: {
      merchantProfileId: null,
      type: LedgerAccountType.SYSTEM_REVENUE,
      currency: Currency.INR,
    }
  })

  if (!existingRevenue) {
    await prisma.ledgerAccount.create({
      data: {
        merchantProfileId: null,
        type: LedgerAccountType.SYSTEM_REVENUE,
        currency: Currency.INR,
        isActive: true,
      }
    })
    console.log('Created SYSTEM_REVENUE INR account.')
  } else {
    console.log('SYSTEM_REVENUE INR account already exists.')
  }

  console.log('Seeding completed successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

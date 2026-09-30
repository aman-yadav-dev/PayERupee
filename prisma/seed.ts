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

  // 3. Seed System Settings
  const settingsCount = await prisma.systemSetting.count()
  if (settingsCount === 0) {
    await prisma.systemSetting.create({
      data: {
        id: "GLOBAL_SETTINGS",
        upiPayoutFee: 0,
        impsPayoutFee: 5,
        neftPayoutFee: 3,
        rtgsPayoutFee: 10,
        taxPercentage: 18,
        minPayoutAmount: 10,
        maxPayoutAmount: 500000,
        reconciliationThresholdMins: 15,
      }
    })
    console.log('Created GLOBAL_SETTINGS.')
  }

  
  // 4. Seed KYC Form
  const existingForm = await prisma.kycForm.findFirst({
    where: { name: "Development Default KYC Form" }
  });

  if (!existingForm) {
    const form = await prisma.kycForm.create({
      data: {
        name: "Development Default KYC Form",
        versions: {
          create: {
            versionNumber: 1,
            status: "PUBLISHED",
            publishedAt: new Date(),
            fields: {
              create: [
                {
                  key: "company_type", label: "Company Type", applicableTypes: ["COMPANY", "LLP"],
                  section: "Identity",
                  dataType: "STRING",
                  inputType: "SELECT",
                  isRequired: true,
                  selectOptions: ["INDIVIDUAL", "PROPRIETOR", "COMPANY", "LLP"],
                  orderIndex: 1
                },
                {
                  key: "company_name",
                  label: "Company Name",
                  section: "Identity",
                  dataType: "STRING",
                  inputType: "TEXT",
                  isRequired: true,
                  applicableTypes: ["COMPANY", "LLP", "INDIVIDUAL"],
                  orderIndex: 2
                },
                {
                  key: "owner_name",
                  label: "Owner Name",
                  section: "Identity",
                  dataType: "STRING",
                  inputType: "TEXT",
                  isRequired: true,
                  applicableTypes: ["INDIVIDUAL", "PROPRIETOR"],
                  orderIndex: 3
                },
                {
                  key: "company_address",
                  label: "Company Address",
                  section: "Identity",
                  dataType: "STRING",
                  inputType: "TEXTAREA",
                  isRequired: true,
                  applicableTypes: [],
                  orderIndex: 4
                },
                {
                  key: "website",
                  label: "Website",
                  section: "Identity",
                  dataType: "STRING",
                  inputType: "TEXT",
                  isRequired: false,
                  applicableTypes: [],
                  orderIndex: 5
                },
                {
                  key: "pan_number",
                  label: "PAN Number",
                  section: "Identity",
                  dataType: "STRING",
                  inputType: "TEXT",
                  isRequired: true,
                  applicableTypes: [],
                  validationRules: { pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$", message: "Invalid PAN format" },
                  orderIndex: 6
                },
                {
                  key: "pan_document",
                  label: "PAN Document",
                  section: "Identity",
                  dataType: "FILE",
                  inputType: "FILE",
                  isRequired: true,
                  applicableTypes: [],
                  orderIndex: 7
                },
                {
                  key: "aadhaar_number",
                  label: "Aadhaar Number",
                  section: "Identity",
                  dataType: "STRING",
                  inputType: "TEXT",
                  isRequired: true,
                  applicableTypes: ["INDIVIDUAL", "PROPRIETOR"],
                  validationRules: { pattern: "^\\d{12}$", message: "Aadhaar must be 12 digits" },
                  orderIndex: 8
                },
                {
                  key: "aadhaar_document",
                  label: "Aadhaar Document",
                  section: "Identity",
                  dataType: "FILE",
                  inputType: "FILE",
                  isRequired: true,
                  applicableTypes: ["INDIVIDUAL", "PROPRIETOR"],
                  orderIndex: 9
                }
              ]
            }
          }
        }
      }
    });
    console.log('Created Development Default KYC Form.');
  } else {
    console.log('Development Default KYC Form already exists.');
    // Force synchronize the applicableTypes on the first form version in case the DB is stale
    const version = await prisma.kycFormVersion.findFirst({
      where: { formId: existingForm.id },
      include: { fields: true }
    });
    if (version) {
      const updates = [
        { key: "company_type", types: ["COMPANY", "LLP"] as import("@prisma/client").MerchantType[] },
          { key: "company_name", types: ["COMPANY", "LLP", "INDIVIDUAL"] as import("@prisma/client").MerchantType[] },
        { key: "owner_name", types: ["INDIVIDUAL", "PROPRIETOR"] as import("@prisma/client").MerchantType[] },
        { key: "aadhaar_number", types: ["INDIVIDUAL", "PROPRIETOR"] as import("@prisma/client").MerchantType[], validationRules: { pattern: "^\\d{12}$", message: "Aadhaar must be 12 digits" } },
        { key: "aadhaar_document", types: ["INDIVIDUAL", "PROPRIETOR"] as import("@prisma/client").MerchantType[] },
        { key: "pan_number", types: [] as import("@prisma/client").MerchantType[], validationRules: { pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$", message: "Invalid PAN format" } }
      ];
      for (const update of updates) {
        const field = version.fields.find(f => f.key === update.key);
        if (field) {
          const dataToUpdate: any = { applicableTypes: update.types };
          if (update.validationRules) {
            dataToUpdate.validationRules = update.validationRules;
          }
          await prisma.kycFieldDefinition.update({
            where: { id: field.id },
            data: dataToUpdate
          });
        }
      }
      console.log('Synchronized applicableTypes for existing Development Default KYC Form.');
    }
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

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.systemConfig.upsert({
    where: { key: 'FLOW_MEDIA_CONFIG' },
    update: {},
    create: {
      key: 'FLOW_MEDIA_CONFIG',
      value: {
        recaptchaSiteKey: '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV',
        apiEndpoint: 'https://aisandbox-pa.googleapis.com/v1/projects/{projectId}/flowMedia:batchGenerateImages',
        defaultProjectId: '101c3bc7-a06a-4dcb-8276-f8ef76202717'
      }
    }
  })
  console.log('Seeded FLOW_MEDIA_CONFIG')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

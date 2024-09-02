import fluxpress from '@fluxpress/core'

async function main() {
  console.log(await fluxpress.fetch.getIssues())
}

main()

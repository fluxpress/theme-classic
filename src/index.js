import fluxpress from '@fluxpress/core'

async function main() {
  console.log(await fluxpress.fetchIssues())
}

main()

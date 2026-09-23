// Gestion des comptes en ligne de commande :
//   npm run user add <nom> [--admin]
//   npm run user passwd <nom>
//   npm run user delete <nom>
//   npm run user list
import readline from 'node:readline/promises'
import { createUser, deleteUser, listUsers, setPassword } from '../users.js'

async function askPassword() {
  if (process.env.USER_PASSWORD) return process.env.USER_PASSWORD
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const password = await rl.question('Mot de passe : ')
  const confirm = await rl.question('Confirmation : ')
  rl.close()
  if (password !== confirm) throw new Error('Les mots de passe ne correspondent pas')
  return password
}

const [command, username, ...flags] = process.argv.slice(2)

try {
  switch (command) {
    case 'add': {
      if (!username) throw new Error('Usage : npm run user add <nom> [--admin]')
      const user = await createUser(username, await askPassword(), { isAdmin: flags.includes('--admin') })
      console.log(`Utilisateur « ${user.username} » créé${user.isAdmin ? ' (administrateur)' : ''}`)
      break
    }
    case 'passwd':
      if (!username) throw new Error('Usage : npm run user passwd <nom>')
      await setPassword(username, await askPassword())
      console.log('Mot de passe mis à jour')
      break
    case 'delete':
      if (!username) throw new Error('Usage : npm run user delete <nom>')
      deleteUser(username)
      console.log('Utilisateur supprimé')
      break
    case 'list':
      for (const u of listUsers()) console.log(`${u.username}${u.isAdmin ? ' (admin)' : ''} — créé le ${u.createdAt}`)
      break
    default:
      console.log('Commandes : add <nom> [--admin] | passwd <nom> | delete <nom> | list')
  }
} catch (err) {
  console.error(`Erreur : ${err.message}`)
  process.exit(1)
}

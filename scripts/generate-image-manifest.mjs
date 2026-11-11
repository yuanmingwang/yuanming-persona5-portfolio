import { readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Browsers cannot list public folders. Index filenames before Vite starts/builds.
const project = new URL('../', import.meta.url)
const catalog = {}
for (const [key, folder] of Object.entries({ menu: 'menu', character: 'character', confidant: 'character confidant icon' })) {
  const directory = new URL(`public/image/${folder}/`, project)
  let entries = []
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  catalog[key] = entries
    .filter(entry => entry.isFile() && /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(entry.name))
    .map(entry => entry.name)
    .sort()
}
await writeFile(new URL('src/content/about-images.json', project), `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Indexed ${catalog.menu.length} menu images and ${catalog.character.length} character images, and ${catalog.confidant.length} confidant images in ${fileURLToPath(project)}.`)

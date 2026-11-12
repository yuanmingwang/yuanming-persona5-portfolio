import test from 'node:test'
import assert from 'node:assert/strict'
import { filterJourney, parseJourney } from '../src/lib/journey.ts'

const header = 'id,order,year,period,type,title,organization,city,country,description,highlights,icon,landmark_image,topics'
const csv = `${header}\ncollege,2,2019,2019–2021,education,College,Example University,"New York, NY",USA,Studied CS,"First highlight\nSecond highlight",school.webp,landmark.webp,CS|Engineering\nintern,1,2018,2018,experience,Internship,Lab,Shenzhen,China,Worked with data,,city.webp,,Python\nnow,3,NOW,Current location,location,Next,City,Vancouver,Canada,Based here,,clock.webp,,Software`

test('journey CSV preserves periods, quoted locations, multiline highlights, and chapter ordering', () => {
  const chapters = parseJourney(csv)
  assert.deepEqual(chapters.map(chapter => chapter.id), ['intern', 'college', 'now'])
  assert.equal(chapters[1].city, 'New York, NY')
  assert.equal(chapters[1].period, '2019–2021')
  assert.deepEqual(chapters[1].highlights, ['First highlight', 'Second highlight'])
  assert.deepEqual(chapters[1].topics, ['CS', 'Engineering'])
  assert.equal(chapters[0].landmarkImage, 'city.webp')
  assert.equal(chapters[2].year, 'NOW')
})

test('journey filters preserve chapter order and include location only in the full timeline', () => {
  const chapters = parseJourney(csv)
  assert.equal(filterJourney(chapters, 'all'), chapters)
  assert.deepEqual(filterJourney(chapters, 'education').map(chapter => chapter.id), ['college'])
  assert.deepEqual(filterJourney(chapters, 'experience').map(chapter => chapter.id), ['intern'])
})

test('invalid or incomplete chapters fail validation before replacing bundled content', () => {
  for (const data of [
    header,
    'id,year\na,2012',
    csv.replace('intern,1', 'intern,bad'),
    csv.replace('intern,1', 'college,1'),
    csv.replace('experience,Internship', 'unknown,Internship'),
    csv.replace('city.webp', ''),
  ]) assert.throws(() => parseJourney(data))
})

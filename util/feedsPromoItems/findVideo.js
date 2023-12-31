const jmespath = require('jmespath')

export function formatSearchObject(searchObject) {
  /* convert Object into a string usable by jmespath
   * {key: value}
   * ["key == `value`"]
   */
  const keys = Object.keys(searchObject)
  const jsmSearcher = keys.reduce((acc, key) => {
    if(key === 'bitrate-range'){
      return  [...acc, `bitrate >= \`${searchObject[key]}\``];
    }
    return [...acc, `${key} == \`${searchObject[key]}\``]
  }, [])

  return jsmSearcher
}

export function findVideo(video, searchObject) {
  /* search video.streams for first video encoding that matches key, values */
  if (video && video.streams && searchObject) {
    const searchString = formatSearchObject(searchObject)
    const videoStreams = jmespath.search(
      video,
      'streams[?'.concat(searchString.join('&&'), ']'),
    )

    if (videoStreams.length) {
      return videoStreams[0]
    }
  }
}

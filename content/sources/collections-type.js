import request from 'request-promise-native'
import { CONTENT_BASE, ARC_ACCESS_TOKEN } from 'fusion:environment'
import { defaultANSFields } from '@wpmedia/feeds-content-source-utils'
import filter from 'lodash.filter'

const fetch = async (key = {}) => {
  const {
    'arc-site': site,
    _id,
    content_alias: contentAlias,
    from,
    size,
    includeFields,
    excludeFields,
    content_type: contentType,
    exclude_subtype: excludeSubType
  } = key
  const qs = {
    website: site,
    from: from || 0,
    size: size || 20,
    published: true,
    ...(_id && { _id: _id.replace(/\//g, '') }),
    ...(contentAlias && { content_alias: contentAlias.replace(/\/$/, '') })
  }

  const querySize = size || 20;

  const options = {
    gzip: true,
    json: true,
    auth: { bearer: ARC_ACCESS_TOKEN },
  }

  const ansFields = [
    ...defaultANSFields,
    'taxonomy.sections',
    'content_elements',
    `websites.${site}`,
  ]

  const filterByContentType = (data) => {
    if(contentType){
      const contentElements = filter(data.content_elements, ['type', contentType]);
      delete data.content_elements;
      data.content_elements = [...contentElements];
    }
    return data
  }

  const getStoriesWithFilter = async (from) => {
    const collectionResp = await request({
      uri: `${CONTENT_BASE}/content/v4/collections`,
      qs: {
        ...qs,
        from: from
      },
      ...options,
    });
    const filteredResp = await filterByContentType(collectionResp);
    return filteredResp;
  } 

  const sortStories = (idsResp, collectionResp, ids, site) => {
    idsResp.content_elements.forEach((item) => {
      const storyIndex = ids.indexOf(item._id)
      // transform websites to sections
      if (
        item?.websites?.[site]?.website_section &&
        !item?.taxonomy?.sections
      ) {
        if (!item.taxonomy) item.taxonomy = {}
        item.taxonomy.sections = [item.websites[site].website_section]
      }
      if (item?.websites?.[site]?.website_url)
        item.website_url = item.websites[site].website_url
      item.website = site
      collectionResp.content_elements.splice(storyIndex, 1, item);
    })

    if(excludeSubType){
      const excSubtypes = excludeSubType.split(',');
      collectionResp.content_elements = collectionResp.content_elements.map((item) => {
        if(!excSubtypes.includes(item.subtype)){
          return item;
        }
      })
      collectionResp.content_elements = collectionResp.content_elements.filter(Boolean);
    }
    return collectionResp
  }

  if (excludeFields) {
    excludeFields.split(',').forEach((i) => {
      if (i && ansFields.indexOf(i) !== -1) {
        ansFields.splice(ansFields.indexOf(i), 1)
      }
    })
  }

  if (includeFields) {
    includeFields
      .split(',')
      .forEach((i) => i && !ansFields.includes(i) && ansFields.push(i))
  }

  // If excluding content_elements, don't call the IDS endpoint
  const makeIDsCall = ansFields.includes('content_elements')

  let collectionResp = await getStoriesWithFilter();
  let step = 1;

  while (collectionResp.content_elements.length < querySize && step < 3) {
    step++;
    const nextBatch = await getStoriesWithFilter((step*querySize));
    collectionResp.content_elements = [...collectionResp.content_elements,...nextBatch.content_elements];
    if(collectionResp.content_elements.length > querySize){
      const trimmed = collectionResp.content_elements.slice(0, querySize);
      collectionResp.content_elements = trimmed;
    }
  }

  //  filter by content type
  // const filteredResp = await filterByContentType(collectionResp);
  const ids = await collectionResp.content_elements.map((item) => {
    return item._id
  })
  if (!makeIDsCall || ids.length === 0) return collectionResp
  const idsResp = await request({
    uri: `${CONTENT_BASE}/content/v4/ids`,
    qs: {
      ids: ids.join(','),
      website: site,
      included_fields: ansFields.join(','),
    },
    ...options,
  })
  return await sortStories(idsResp, collectionResp, ids, site)
}

export default {
  fetch,
  params: [
    {
      name: '_id',
      displayName: 'Collection ID',
      type: 'text',
    },
    {
      name: 'content_alias',
      displayName: 'Collection Alias (Only populate ID or Alias)',
      type: 'text',
    },
    {
      name: 'from',
      displayName: 'From - Integer offset to start from',
      type: 'number',
    },
    {
      name: 'size',
      displayName: 'Number of records to return, Integer 1 - 20',
      type: 'number',
    },
    {
      name: 'includeFields',
      displayName: 'ANS Fields to include, use commas between fields',
      type: 'text',
    },
    {
      name: 'excludeFields',
      displayName: 'ANS Fields to Exclude, use commas between fields',
      type: 'text',
    },
    {
      name: 'content_type',
      displayName: 'Content Types: story, video, gallery',
      type: 'text',
      default: 'story'
    },
    {
      name: 'exclude_subtype',
      displayName: 'Subtypes to exclude (csv)',
      type: 'text'
    }
  ],
  ttl: 300,
}

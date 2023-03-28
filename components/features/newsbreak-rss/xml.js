import PropTypes from 'fusion:prop-types'
import Consumer from 'fusion:consumer'
import moment from 'moment'
import getProperties from 'fusion:properties'
import { resizerKey } from 'fusion:environment'
import { BuildContent } from '@wpmedia/feeds-content-elements'
import { BuildPromoItems } from '../../../util/feedsPromoItems/promoItems'
import { generatePropsForFeed } from '@wpmedia/feeds-prop-types'
import { buildResizerURL } from '@wpmedia/feeds-resizer'
import URL from 'url'
const jmespath = require('jmespath')

const rssTemplate = (
  elements,
  {
    channelTitle,
    channelDescription,
    channelCopyright,
    channelTTL,
    channelUpdatePeriod,
    channelUpdateFrequency,
    channelCategory,
    channelLogo,
    imageTitle,
    imageCaption,
    imageCredits,
    itemTitle,
    itemDescription,
    pubDate,
    itemCredits,
    itemCategory,
    includePromo,
    includeContent,
    videoSelect,
    requestPath,
    resizerURL,
    resizerWidth,
    resizerHeight,
    promoItemsJmespath,
    domain,
    feedTitle,
    channelLanguage,
    rssBuildContent,
    PromoItems,
  },
) => ({
  rss: {
    '@xmlns:atom': 'http://www.w3.org/2005/Atom',
    '@xmlns:nb': 'https://www.newsbreak.com/',
    '@xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
    ...(itemCredits && {
      '@xmlns:dc': 'http://purl.org/dc/elements/1.1/',
    }),
    ...(channelUpdatePeriod &&
      channelUpdatePeriod !== 'Exclude field' && {
        '@xmlns:sy': 'http://purl.org/rss/1.0/modules/syndication/',
      }),
    '@version': '2.0',
    ...(includePromo && {
      '@xmlns:media': 'http://search.yahoo.com/mrss/',
    }),
    channel: {
      title: { $: channelTitle || feedTitle },
      link: `${domain}`,
      'atom:link': {
        '@href': `${domain}${requestPath}`,
        '@rel': 'self',
        '@type': 'application/rss+xml',
      },
      description: { $: channelDescription || `${feedTitle} News Feed` },
      lastBuildDate: moment
        .utc(new Date())
        .format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
      ...(channelLanguage &&
        channelLanguage.toLowerCase() !== 'exclude' && {
          language: channelLanguage,
        }),
      ...(channelCategory && { category: channelCategory }),
      ...(channelCopyright && {
        copyright: channelCopyright,
      }), // TODO Add default logic
      ...(channelTTL && { ttl: channelTTL }),
      ...(channelUpdatePeriod &&
        channelUpdatePeriod !== 'Exclude field' && {
          'sy:updatePeriod': channelUpdatePeriod,
        }),
      ...(channelUpdateFrequency &&
        channelUpdatePeriod !== 'Exclude field' && {
          'sy:updateFrequency': channelUpdateFrequency,
        }),
      ...(channelLogo && {
        image: {
          url: buildResizerURL(channelLogo, resizerKey, resizerURL),
          title: channelTitle || feedTitle,
          link: domain,
        },
      }),

      item: elements.map((s) => {
        let author, body, category
        const url = `${domain}${s.website_url || s.canonical_url || ''}`
        
        // Newsbreak needs the article thumbnail by itself
        const thumbnail = PromoItems.mediaThumbnailTag({
          ans: s,
          promoItemsJmespath,
          resizerKey,
          resizerURL,
          resizerWidth,
          resizerHeight,
          imageTitle,
          imageCaption,
          imageCredits,
          videoSelect,
        });

        // const img = PromoItems.mediaTag({
        //   ans: s,
        //   promoItemsJmespath,
        //   resizerKey,
        //   resizerURL,
        //   resizerWidth,
        //   resizerHeight,
        //   imageTitle,
        //   imageCaption,
        //   imageCredits,
        //   videoSelect,
        // })
        
        const leadArt = PromoItems.leadArtImage({
          ans: s,
          promoItemsJmespath: 'promo_items.lead_art',
          resizerKey,
          resizerURL,
          resizerWidth,
          resizerHeight,
          imageTitle,
          imageCaption,
          imageCredits,
          videoSelect: false,
        })
        
        const leadArtVideo = PromoItems.leadArtVideo({
          ans: s,
          promoItemsJmespath: 'promo_items.lead_art',
          resizerKey,
          resizerURL,
          resizerWidth,
          resizerHeight,
          imageTitle,
          imageCaption,
          imageCredits,
          videoSelect,
        })

        return {
          ...(itemTitle && {
            title: { $: jmespath.search(s, itemTitle) || '' },
          }),
          link: url,
          guid: {
            '#': url,
            '@isPermaLink': true,
          },
          ...(itemCredits &&
            (author = jmespath.search(s, itemCredits)) &&
            author.length && {
              'dc:creator': { $: author.join(', ') },
            }),
          ...(itemDescription && {
            description: { $: jmespath.search(s, itemDescription) || '' },
          }),
          pubDate: moment
            .utc(s[pubDate])
            .format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
          "atom:updated": moment
            .utc(s.last_updated_date)
            .format('YYYY-MM-DDTHH:mm:ss[Z]'),
          ...(itemCategory &&
            (category = jmespath.search(s, itemCategory)) &&
            category && { category: { $: category } }),
          // category: s.taxonomy.sections.map((section)=>{

          //   return {
          //     $: section.name,
          //     '@domain': section._id,
          //     '@primary': (section._id===s.taxonomy.primary_section._id)
          //   }
          // }),
          ...(includeContent !== 0 &&
            (body = rssBuildContent.parse(
              s.content_elements || [],
              includeContent,
              domain,
              resizerKey,
              resizerURL,
              resizerWidth,
              resizerHeight,
              videoSelect,
            )) &&
            body && {
              'content:encoded': {
                ...(leadArtVideo && s?.promo_items?.lead_art?.type==='video' && { $Video: leadArtVideo }),
                ...(!leadArtVideo && leadArt && s?.promo_items?.lead_art?.type==='image' && { $Image: leadArt }),
                $0: (s.subheadlines?.basic ? `<h2>${s.subheadlines.basic}</h2>` : ''),
                $1: body,
              },
            }),
          ...(includePromo && thumbnail && { '#': thumbnail }),
          // ...(includePromo && img && { '#1': img }),
          // ...(s?.promo_items?.lead_art?.type==='video' && { lead_video_embed: { $: s.promo_items.lead_art.embed_html }}),
          // ...(s?.promo_items?.lead_art?.type==='video' && { lead_video_id: s.promo_items.lead_art._id})
        }
      }),
    },
  },
})

export function NewBreakRss({ globalContent, customFields, arcSite, requestUri }) {
  const {
    resizerURL = '',
    feedDomainURL = 'http://localhost.com',
    feedTitle = '',
    feedLanguage = '',
  } = getProperties(arcSite)
  const channelLanguage = customFields.channelLanguage || feedLanguage
  const { width = 0, height = 0 } = customFields.resizerKVP || {}
  const requestPath = new URL.URL(requestUri, feedDomainURL).pathname

  const PromoItems = new BuildPromoItems()
  const rssBuildContent = new BuildContent()

  // can't return null for xml return type, must return valid xml template
  return rssTemplate(globalContent.content_elements || [], {
    ...customFields,
    requestPath,
    resizerURL,
    resizerWidth: width,
    resizerHeight: height,
    domain: feedDomainURL,
    feedTitle,
    channelLanguage,
    rssBuildContent,
    PromoItems,
  })
}

NewBreakRss.propTypes = {
  customFields: PropTypes.shape({
    ...generatePropsForFeed('rss', PropTypes),
  }),
}
NewBreakRss.label = 'RSS NewsBreak - 910'
NewBreakRss.icon = 'arc-rss'
export default Consumer(NewBreakRss)

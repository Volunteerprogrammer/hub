/**
 * Content for each menu item.
 *
 * This is the single place to edit the words on the site. Each key
 * matches a menu button's data-page attribute in index.html.
 *
 * Replace the placeholder entries (and tidy up the drafted ones) when
 * the final copy is ready — nothing else needs to change.
 */
const PAGES = {
  intro: {
    title: 'Welcome',
    html: `
      <div class="callout callout-blue">
        <p>The <strong>Woodend Community Emergency Hub</strong> is a local, community-led space where you can 
           stay connected, seek relief, seek help, charge your devices and get information and advice 
           after a bushfire or during a severe weather event or severe heatwave.</p>
      </div>
      <p>Natural disasters can be chaotic, confusing and incredibly stressful for a community.</p>
      <p>During this time, emergency services and Council may be stretched and unable to respond
         immediately to every need. It can take time for assistance, information and essential
         services to reach everyone affected.</p>
      <p class="lead">That's where community support becomes so important.</p>
      <p>The <strong>Woodend Community Emergency Hub</strong> is a place for local residents to come together,
         share information, coordinate practical support and help one another in an emergency.</p>
      <p>It's about neighbours helping neighbours, bringing local knowledge, skills and resources
         together, and making sure our community can support itself when it matters most.</p>
    `,
  },

  when: {
    title: 'When is it open?',
    html: `
      <p>The Hub is activated</p>
      <ul>
        <li>during or after a <strong>bushfire</strong>, once emergency services, local authorities, and 
              Council officially declare the township safe</li>
        <li>during a <strong>severe storm</strong> or <strong>severe thunderstorm</strong> (as declared by the Bureau of Meteorology),  </li>
        <li>during a severe or extreme <strong>heatwave</strong> (as declared by the Bureau of Meteorology).</li>
      </ul>

      <p>The indicator at the top of this page always shows whether the Hub is currently
         <strong>open</strong> or <strong>closed</strong>, and updates automatically.</p>
    `,
  },

  where: {
    title: 'Where is it?',
    html: `
      <div class="callout callout-relocated" id="hub-relocation-notice" hidden>
        <p>NOTE: the HUB has been relocated away from the Woodend Neighbourhood House.</p>
      </div>

      <div class="where-top">
        <div class="where-address">
          <p>
            <strong>Hub location</strong><br>
            <span id="hub-venue">Woodend Neighbourhood House</span><br>
            <span id="hub-address">47 Forest Street, Woodend</span>
          </p>

          <div class="callout callout-amber">
            <p>In some circumstances, it may not be safe to operate the HUB at the Neighbourhood
               House. If we are able to operate the HUB safely at another location, we will post
               the new address here.</p>
          </div>
        </div>

        <div class="map-embed">
          <iframe
            id="hub-map-frame"
            src=""
            title="Map showing the Hub location"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allowfullscreen>
          </iframe>
        </div>
      </div>

      <p>
        <a id="hub-directions-link" href="#" target="_blank" rel="noopener">
          Get directions
        </a>
      </p>
    `,
  },

  // Title is a fallback only — app.js overrides it at render time with
  // "GET ADVICE NOW" (Hub open) or "Where to get Advice" (Hub closed),
  // and shows/hides the blocks below to match: when open, only the
  // block(s) for the active emergency type(s) are shown; when closed,
  // all three are shown as general reference.
  advice: {
    title: 'Where to get Advice',
    html: `
      <div class="advice-block" data-event="bushfire">
        <h2>Bushfire</h2>
        <p><a href="https://www.emergency.vic.gov.au/" target="_blank">VicEmergency</a>: for real-time emergency warnings, incident updates. </p>
        <p>Listen to the radio: Tune into your <strong>local ABC Local Radio station</strong> for emergency broadcasts:
        </p>
        <ul><li>ABC Central Victoria, broadcast on 91.1 FM, or</li><li>ABC Radio Melbourne on 774 AM.</li></ul>
        <p>For Fire bans, ratings and restrictions, visit the <a href="https://www.cfa.vic.gov.au/warnings-and-restrictions/fire-bans-ratings-and-restrictions/total-fire-bans-fire-danger-ratings/central-fire-district" target="_blank">Country Fire Authority (CFA) Central fire district</a> page.</p>
        <p>For preparation and planning, visit the <a href="https://www.cfa.vic.gov.au/fire-safety" target="_blank">Country Fire Authority (CFA) Fire Safety</a> page.</p>
      </div>
      <div class="advice-block" data-event="storm">
        <h2>Severe Storm</h2>
        <p><a href="https://emergency.vic.gov.au" target="_blank">VicEmergency</a> is Victoria's centralized platform for live emergency warnings, watch zones, incident tracking, and active road closures. Type or paste "HIGH STREET WOODEND 3442" into the text entry above the map then hit "Enter" to zoom in. You can also download the VicEmergency app or call the free VicEmergency Hotline at 1800 226 226.</p>
        <p><a href="https://www.bom.gov.au/location/australia/victoria/central/o273048501-woodend" target="_blank">Bureau of Meteorology</a>is the official source for weather forecasts, live radar maps, and official severe thunderstorm or severe weather warnings. This link opens on the Woodend location. There is a Weather map displaying a Rain Radar at the bottom of the page (with Woodend pinned).</p>
        <p><a href="https://www.abc.net.au/emergency/incidentsearch?view=map&query=aurora%3A%2F%2Flocation%2Flocc1a0d959fb46&radius=FiftyKm" target="_blank">ABC Emergency</a> is the official emergency broadcaster providing up-to-date local radio coverage, news, and community updates during severe weather events. This link opens on the Woodend location. Or tune into your local ABC Local Radio station for emergency broadcasts:<p>
       <ul><li>ABC Central Victoria, broadcast on 91.1 FM, or</li><li>ABC Radio Melbourne on 774 AM.</li></ul>
        <p><a href="https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/storm" target="_blank">Victoria State Emergency Service</a>is the lead control agency for storms, floods, and landslides in Victoria, providing practical safety advice and storm preparation guides. The link opens on the "Storms - Plan and stay safe" page. Click the logo at the top left to go to the home page.<p>
        <p>Learn more about severe thunderstorms here: <a href="https://www.bom.gov.au/news-and-media/severe-thunderstorms-what-you-need-to-know" target="_blank">BOM: Severe thunderstorms: what you need to know</a><p>
        <p>Learn more about what to do during a storm or severe weather, go to <a href="https://https://www.abc.net.au/emergency/what-to-do-during-a-storm-or-severe-weather/102387818" target="_blank">ABC Emergency: What to do during a storm or severe weather</a><p>
      </div>
      <div class="advice-block" data-event="heatwave">
        <h2>Heatwave</h2>
        <p><a href="https://www.bom.gov.au/location/australia/victoria/central/o273048501-woodend" target="_blank">Bureau of Meteorology</a> is the best source for official severe and extreme heatwave warnings, local temperature forecasts, and the BOM Weather app.</p>
        <p><a href="https://www.bom.gov.au/weather-and-climate/specialised-forecasts-and-observations/heatwave" target="_blank">Bureau of Meteorology Heatwave page</a> displays the Heatwave conditions for today and the next six days for Victoria (from October until the end of March).</p>
        <p>The Victorian Government's <a href="https://www.betterhealth.vic.gov.au/extreme-heat" target="_blank">Better Health Channel</a> provides essential medical advice on recognizing heat exhaustion, heatstroke, and protecting vulnerable groups.</p>
        <p><a href="https://www.health.vic.gov.au/environmental-health/heat-health-warning" target="_blank">Department of Health Victoria</a> is the key site for heat-health warnings, health risk advisories, and guidance on staying safe during high temperatures.</p
      </div>
    `,
  },


  about: {
    title: 'About the HUB',
    html: `
      <p>The Volunteer-run <strong>Woodend Community Emergency HUB</strong> is a project of the Woodend Neighbourhood House.</p>
      <p>Developed over 2026 in collaboration with the SES, CFA and Macedon Ranges Shire Council, it follows the lines of similar initiatives in other towns in the Shire. </p>   
    `,
  },

  volunteers: {
    title: 'Can I Volunteer?',
    html: `
      <p>The HUB's operation is entirely managed by Volunteers. The current volunteers are the core group that formed during the development of the project and who have trained in the operation. But more volunteers are required.</p>
      <p>There are several roles to be performed when a Hub is open: Hub Supervisor, Reception, Community Support, Communications, Needs and Offers manager (logistics), First Aid and Facility Manager.</p>   
      <p>If you feel you can help with any of these and are interested becoming involved with the volunteer group, please contact the Woodend Neighbourhood House Manager (Email: reception@woodendnh.org.au, Phone: (03) 5427 1845).</p>   
    `,
  },
  placeholder2: {
    title: 'Placeholder 1',
    html: `
      <p><em>Placeholder text. This menu item is reserved for content to be supplied later —
         replace this block with the real copy when it's ready.</em></p>
    `,
  },


};

const DEFAULT_PAGE = 'intro';

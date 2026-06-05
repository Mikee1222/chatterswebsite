#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();
if (!TOKEN || !BASE_ID) { console.error("Missing env vars"); process.exit(1); }

const API = `https://api.airtable.com/v0/${BASE_ID}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

const REVENUE_TO_MODEL: Record<string, string> = {
  // Marilia (recgmObP5ezDeEPDs)
  "rec9KkOpnGmDFmbEU":"recgmObP5ezDeEPDs","recw0ivGfpBmF6AZg":"recgmObP5ezDeEPDs","recqkMoGquwaX7QNc":"recgmObP5ezDeEPDs","recH0Gdjv8MNJLJA0":"recgmObP5ezDeEPDs","recTmRf5nMz66OkFR":"recgmObP5ezDeEPDs","rec9iEp60vk58jMC0":"recgmObP5ezDeEPDs","rec5zmqzrGXRCDTDY":"recgmObP5ezDeEPDs","recurRt5LyAndWkGZ":"recgmObP5ezDeEPDs","receh8pjX7E5yoLt3":"recgmObP5ezDeEPDs","recLUXjh6lBeTEXEp":"recgmObP5ezDeEPDs","recp1TcnKDMTGP4fs":"recgmObP5ezDeEPDs","reci1R3oy8fD9Swzd":"recgmObP5ezDeEPDs","recj6ZsjjnDDdKHai":"recgmObP5ezDeEPDs","rec6S8pz39WBF1yvk":"recgmObP5ezDeEPDs","recJxfwFN0WodDGZQ":"recgmObP5ezDeEPDs",
  // Eirini (rec7jwVGwQZ5uYXKl)
  "recuRLZZaDpBJDa77":"rec7jwVGwQZ5uYXKl","recaBvkpCKg5nCdKf":"rec7jwVGwQZ5uYXKl","recCk6dLMHTQcgmeS":"rec7jwVGwQZ5uYXKl","recpcjLFED7LrqTsl":"rec7jwVGwQZ5uYXKl","recbCAIqWCcGQpljX":"rec7jwVGwQZ5uYXKl","recWqPjbSa1tc2mN6":"rec7jwVGwQZ5uYXKl","rec0MAALlWF2LDtEB":"rec7jwVGwQZ5uYXKl","recfFhoFiwOLEttZx":"rec7jwVGwQZ5uYXKl","recambKc4UkYKAxfz":"rec7jwVGwQZ5uYXKl","rec7Xe1tJetenFPgU":"rec7jwVGwQZ5uYXKl","rec2YPxgxDui9BnDS":"rec7jwVGwQZ5uYXKl","reciZBN4h3iMP1sRf":"rec7jwVGwQZ5uYXKl","recAsZgoPpU1sKsD4":"rec7jwVGwQZ5uYXKl","recb0Vx5XGbusWQ04":"rec7jwVGwQZ5uYXKl","recYeOi2xEgiLX51l":"rec7jwVGwQZ5uYXKl",
  // Stella (rec3LzkuHyMkUgb4m)
  "recHtfXZcLa5wAmIv":"rec3LzkuHyMkUgb4m","recjNIEQlBMZYOPxg":"rec3LzkuHyMkUgb4m","rectaMRB6G1S17ezq":"rec3LzkuHyMkUgb4m","recALChJO8voiLmaM":"rec3LzkuHyMkUgb4m","recLN40YrX5IU82Pa":"rec3LzkuHyMkUgb4m","recjyUag2SM6Em2PM":"rec3LzkuHyMkUgb4m","reclih3DW9vD7skfz":"rec3LzkuHyMkUgb4m","recvdYbYm1IQUPrLG":"rec3LzkuHyMkUgb4m","receN2uuwPuCRbICa":"rec3LzkuHyMkUgb4m","recx7kRLWdcONAGdN":"rec3LzkuHyMkUgb4m","rec2SF8hZY5Ju0IUM":"rec3LzkuHyMkUgb4m","rec3CcU3MqUmVfRXQ":"rec3LzkuHyMkUgb4m","recML1de3yjAp12xF":"rec3LzkuHyMkUgb4m","recAblyuSkZprPHSW":"rec3LzkuHyMkUgb4m","rec7FKXz0kDGDwu8y":"rec3LzkuHyMkUgb4m",
  // Chrysa (recq7xz385YNmqqE2)
  "reczSGvHrNa2NjzTA":"recq7xz385YNmqqE2","recR36ekykEHY7Rzu":"recq7xz385YNmqqE2","reckzwHiRy5yt8ZZR":"recq7xz385YNmqqE2","recgEYCPBB2GfpwIN":"recq7xz385YNmqqE2","recNhRkC4ZuqfJs3Z":"recq7xz385YNmqqE2","rec8abOgzDY1t4O1H":"recq7xz385YNmqqE2","rec85h2WNtDjPCahl":"recq7xz385YNmqqE2","recdpAPJHhnhWOXVv":"recq7xz385YNmqqE2","rec5CgVVSymqItuQ8":"recq7xz385YNmqqE2","recwTw9oGcafXdbvp":"recq7xz385YNmqqE2","rectjpViEYQGxttog":"recq7xz385YNmqqE2","recHTrjxLpvEP2Li1":"recq7xz385YNmqqE2","recToweTnJivAyDTU":"recq7xz385YNmqqE2",
  // Katerina (rec2LJI8PmRlHE9q5)
  "reczotLa9jKM3VeXR":"rec2LJI8PmRlHE9q5","recJCOdN9By2HXA4D":"rec2LJI8PmRlHE9q5","recbE2uXAXiaYnveo":"rec2LJI8PmRlHE9q5","recjLLWoABDpeMaIa":"rec2LJI8PmRlHE9q5","rec7w4ONjVXJDhYN4":"rec2LJI8PmRlHE9q5","recAUU6H7acnZLzHz":"rec2LJI8PmRlHE9q5","recYCAvT0a4PHzpa9":"rec2LJI8PmRlHE9q5","recH0ZVElE5O5l1Xx":"rec2LJI8PmRlHE9q5",
  // Elisavet (recG1jdOuQAE5UV2Y)
  "recWL1fW2VIj7RalK":"recG1jdOuQAE5UV2Y","recf4njLptsZkuskb":"recG1jdOuQAE5UV2Y","recSG0WJ75kaSz4jG":"recG1jdOuQAE5UV2Y","recYPDSwTRKAzIxM5":"recG1jdOuQAE5UV2Y","recrj4xLCyycyP2PY":"recG1jdOuQAE5UV2Y","recpfAOTHz8bEFaus":"recG1jdOuQAE5UV2Y","rectnswH1CHG8HMfJ":"recG1jdOuQAE5UV2Y","recvV6JytDJ71m9zY":"recG1jdOuQAE5UV2Y","rec5nrr0OnWE8JVJL":"recG1jdOuQAE5UV2Y","recGjvRH7TV5FqtAx":"recG1jdOuQAE5UV2Y","recZ2ylo5yzTuoLat":"recG1jdOuQAE5UV2Y","recpoiFnS5xbgPlDi":"recG1jdOuQAE5UV2Y",
  // Dianna (recOzM1qmbUIzWUiR)
  "recKlxAPycCtTUm0L":"recOzM1qmbUIzWUiR","recaG0IJbHojk0vW1":"recOzM1qmbUIzWUiR","rec2R5uRtM3FXLyul":"recOzM1qmbUIzWUiR","recENjmRY9tJgKD3l":"recOzM1qmbUIzWUiR","recjQuno6uVvs1Kqi":"recOzM1qmbUIzWUiR","reclBygOLsxGkmXLg":"recOzM1qmbUIzWUiR","recpSGjRg5HrdLpXB":"recOzM1qmbUIzWUiR","recOsWaPxguIq4lTR":"recOzM1qmbUIzWUiR","recFcn2DdZlvYLvjQ":"recOzM1qmbUIzWUiR","recg6KGxGrMA19WsW":"recOzM1qmbUIzWUiR","rec7PbbBC4aZWSMsk":"recOzM1qmbUIzWUiR","reca3FHkddyLJMEsQ":"recOzM1qmbUIzWUiR","recwrms4qt40Om6HR":"recOzM1qmbUIzWUiR","recCeG6yrCFc68L5t":"recOzM1qmbUIzWUiR","recKWFaV0F9eN6lxV":"recOzM1qmbUIzWUiR",
  // Stefania (recRYzE3HViBXRl0k)
  "rechxfVhjg5v8pTaI":"recRYzE3HViBXRl0k","recOPvCaPzqnwlS0w":"recRYzE3HViBXRl0k","recaVPmNh6d2qzKIz":"recRYzE3HViBXRl0k","recWet2ivHtJ6AcRA":"recRYzE3HViBXRl0k","rec9lY3LtKaqZsVBr":"recRYzE3HViBXRl0k","recYj897YtCPa2pop":"recRYzE3HViBXRl0k","recgFdk7RsttsuB5d":"recRYzE3HViBXRl0k","recsYXNxpkpmmk5lA":"recRYzE3HViBXRl0k","recyA1TCG9RE6zvb2":"recRYzE3HViBXRl0k","recQwker21XcdcXWT":"recRYzE3HViBXRl0k","recyfvl10PEKNbHm0":"recRYzE3HViBXRl0k","rec4B6xQ8TKJCsm5G":"recRYzE3HViBXRl0k","reckQmPTnae7OAOqm":"recRYzE3HViBXRl0k","rec6L3hQx62rwPR7j":"recRYzE3HViBXRl0k","recLezROrPkSw2Rnc":"recRYzE3HViBXRl0k",
  // Gavriela (rec0IuyyDDK9AgmAd)
  "recG07G7TLLxFcK2R":"rec0IuyyDDK9AgmAd","rec7TNqugZpEj6i3L":"rec0IuyyDDK9AgmAd","rec3V1oS1iwAZtUMC":"rec0IuyyDDK9AgmAd","recRh2aCQSAgvVp5z":"rec0IuyyDDK9AgmAd","recPVrvPy75tfrKcw":"rec0IuyyDDK9AgmAd","recWUZ8EvLc3k5qbA":"rec0IuyyDDK9AgmAd","recTyarJ52S9ZgsQW":"rec0IuyyDDK9AgmAd","recC0U5iWJ7xJ2IQ3":"rec0IuyyDDK9AgmAd","recEWxhNb0k7geoe2":"rec0IuyyDDK9AgmAd","rec2HdWvWNpYCrSM3":"rec0IuyyDDK9AgmAd",
  // Antigoni (rec4xhKEJllCmeDjC)
  "reci9WhjTPGbBUJGJ":"rec4xhKEJllCmeDjC","recMSEA6aRql4Lf3W":"rec4xhKEJllCmeDjC","recI2C1L6rRW2Qxm6":"rec4xhKEJllCmeDjC","recw9cDcpnLLiyFnK":"rec4xhKEJllCmeDjC","recO2wKMGMI6OgU6l":"rec4xhKEJllCmeDjC","recDuStSgCM9ulVAC":"rec4xhKEJllCmeDjC","rec7VfJeweySmI6Te":"rec4xhKEJllCmeDjC","recgjFrK21re0NL9y":"rec4xhKEJllCmeDjC","rec16mbeMItOP0wHO":"rec4xhKEJllCmeDjC","recVMIq7qXoCkwZSs":"rec4xhKEJllCmeDjC","recz494YqNLz05xc1":"rec4xhKEJllCmeDjC","recPLmcEmdilkJzvH":"rec4xhKEJllCmeDjC","rec8vmQjmnkYw2YaO":"rec4xhKEJllCmeDjC","recGhQoiqAY9JEjb2":"rec4xhKEJllCmeDjC","recrf7U0x4qwRfJmA":"rec4xhKEJllCmeDjC",
  // Ariandi (recxGew2CD6UlBoPf)
  "recM1PB1LNPBoQkqw":"recxGew2CD6UlBoPf","recIYNbvk290Jvyvc":"recxGew2CD6UlBoPf","recWHk92CQkq0jQq4":"recxGew2CD6UlBoPf","recfyo70CrGOdHbDf":"recxGew2CD6UlBoPf","rec4zrf6vwVoRKOUe":"recxGew2CD6UlBoPf","recSlpz47H5UFVlz2":"recxGew2CD6UlBoPf","recSFoe3plFgIcjjR":"recxGew2CD6UlBoPf","reciNrWI3FP0oSncM":"recxGew2CD6UlBoPf","recHK6lcrXBd8EM37":"recxGew2CD6UlBoPf","recfdgiZ6X2MXl7FQ":"recxGew2CD6UlBoPf","recpXJCli4ipKgYfd":"recxGew2CD6UlBoPf","recnYMaxYiKrMexip":"recxGew2CD6UlBoPf","recyfnTq8duh4NzzW":"recxGew2CD6UlBoPf","recor1ZKiPpoIFtK4":"recxGew2CD6UlBoPf","receqtvjVY0wqzeoz":"recxGew2CD6UlBoPf",
};

async function main() {
  const API = `https://api.airtable.com/v0/${BASE_ID}`;
  const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

  let updated = 0, failed = 0;

  for (const [revenueId, modelId] of Object.entries(REVENUE_TO_MODEL)) {
    const res = await fetch(`${API}/billing_cycle_revenues/${revenueId}`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ fields: { model: [modelId] } }),
    });
    if (res.ok) {
      updated++;
    } else {
      console.error(`❌ ${revenueId}: ${await res.text()}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 220));
  }

  console.log(`✅ Done: ${updated} updated, ${failed} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });

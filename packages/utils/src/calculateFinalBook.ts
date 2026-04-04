export interface BookResult {
  teamA_PL: number;
  teamB_PL: number;
}

interface MappedRecord {
  teamA_back_odd: number;
  teamA_lay_odd: number;
  teamA_back_price: number;
  teamA_lay_price: number;
  teamB_back_odd: number;
  teamB_lay_odd: number;
  teamB_back_price: number;
  teamB_lay_price: number;
}

export const mapRecord = (doc: any): MappedRecord => ({
  teamA_back_odd: doc.teamA.odds[0],
  teamA_lay_odd: doc.teamA.odds[1],
  teamA_back_price: doc.teamA.pricing[0],
  teamA_lay_price: doc.teamA.pricing[1],
  teamB_back_odd: doc.teamB.odds[0],
  teamB_lay_odd: doc.teamB.odds[1],
  teamB_back_price: doc.teamB.pricing[0],
  teamB_lay_price: doc.teamB.pricing[1],
});

export const calculateNetBook = (records: MappedRecord[]): BookResult => {
  let teamA_PL = 0;
  let teamB_PL = 0;

  for (const record of records) {
    const backA_PL_ifA = (record.teamA_back_odd - 1) * record.teamA_back_price;
    const backA_PL_ifB = -record.teamA_back_price;

    const layA_PL_ifA = -(record.teamA_lay_odd - 1) * record.teamA_lay_price;
    const layA_PL_ifB = record.teamA_lay_price;

    const backB_PL_ifB = (record.teamB_back_odd - 1) * record.teamB_back_price;
    const backB_PL_ifA = -record.teamB_back_price;

    const layB_PL_ifB = -(record.teamB_lay_odd - 1) * record.teamB_lay_price;
    const layB_PL_ifA = record.teamB_lay_price;

    teamA_PL += backA_PL_ifA + layA_PL_ifA + backB_PL_ifA + layB_PL_ifA;
    teamB_PL += backA_PL_ifB + layA_PL_ifB + backB_PL_ifB + layB_PL_ifB;
  }

  return { teamA_PL, teamB_PL };
};

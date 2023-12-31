import { LanguagePercentage, JobOfferCounts, JobOffer } from "@/types";

export class DataProcessingService {
  
  /**
   * Transforme une offre d'emploi brute en un objet JobOffer.
   * @param jsonOffer L'offre d'emploi brute.
   * @returns Un objet JobOffer.
   */
  transformToJobOffer(jsonOffer: any): JobOffer {
    return {
      id: jsonOffer.id,
      libelle: jsonOffer.intitule,
      description: jsonOffer.description
    };
  }

  /**
   * Transforme un tableau d'offres d'emploi brutes en un tableau d'objets JobOffer.
   * @param rawData Le tableau d'offres d'emploi brutes.
   * @returns Un tableau d'objets JobOffer.
   */
  processJobOffers(rawData: any[]): JobOffer[] {
    return rawData.map(this.transformToJobOffer);
  }

  /**
   * Calcule le pourcentage de présence de chaque langage de programmation dans le département concerné, arrondi à l'entier le plus proche.
   * Trie ensuite les langages par pourcentage le plus haut et retourne un tableau d'objets avec le langage et son pourcentage.
   * @param jobOfferCounts Objet contenant le nombre d'offres d'emploi pour chaque langage de programmation.
   * @returns Tableau d'objets contenant le langage et son pourcentage de présence, trié par ordre décroissant de pourcentage.
   */
  public calculateLanguagePercentages(
    jobOfferCounts: JobOfferCounts
  ): LanguagePercentage[] {
    // Tableau des langages de programmation à rechercher, trié par ordre alphabétique
    const languages = Object.keys(jobOfferCounts).sort();

    // Calcul du nombre total d'offres d'emploi pour tous les langages
    const totalJobOffers = Object.values(jobOfferCounts).reduce(
      (total, count) => total + count,
      0
    );

    // Calcul des pourcentages de présence pour chaque langage et création d'un tableau d'objets avec le langage et son pourcentage
    const percentages: LanguagePercentage[] = languages.map((language) => {
      const jobOffersForLanguage = jobOfferCounts[language] || 0;
      let percentage;
      if (totalJobOffers !== 0) {
        percentage = (jobOffersForLanguage / totalJobOffers) * 100;
      } else {
        percentage = 0;
      }
      const roundedPercentage = Math.round(percentage);
      return { language, percentage: roundedPercentage };
    });

    // Tri du tableau d'objets par ordre décroissant de pourcentage
    percentages.sort((a, b) => b.percentage - a.percentage);

    // Ajout de la différence entre 100 et la somme des pourcentages arrondis
    const sumOfPercentages = percentages.reduce(
      (total, { percentage }) => total + percentage,
      0
    );
    if (percentages.length > 0) {
      const difference = 100 - sumOfPercentages;
      percentages[0].percentage += difference;
    }

    return percentages;
  }
}

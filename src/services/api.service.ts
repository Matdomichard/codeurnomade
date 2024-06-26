import axios, { AxiosInstance } from "axios";

// Définition de l'interface pour la réponse de l'API
import { JobOffer } from "@/types";

interface JobOffersSearchResponse {
  resultats: JobOffer[];
}

export class ApiService {
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private accessTokenExpiration: Date | null = null;

  constructor() {
    // Crée une instance d'Axios avec l'URL de base de l'API France travail
    this.axiosInstance = axios.create({
      baseURL: "https://api.francetravail.io/partenaire/offresdemploi/v2",
    });

    // Récupère le token depuis le local storage lors de la création de l'instance
    this.retrieveTokenFromLocalStorage();
  }

  // Méthode privée pour actualiser le token d'accès si nécessaire
  private async refreshToken(): Promise<void> {
    // Vérifie si le token est toujours valide (avec une marge de 5 minutes)
    if (
      this.accessToken &&
      this.accessTokenExpiration &&
      new Date() <
        new Date(this.accessTokenExpiration.getTime() - 5 * 60 * 1000)
    ) {
      return;
    }

    const proxyUrl = import.meta.env.VITE_APP_PROXY_URL + "/api/get_token";

    if (!proxyUrl) {
      throw new Error("VITE_APP_PROXY_URL is not defined");
    }
    try {
      const response = await axios.post(proxyUrl);
      this.accessToken = response.data.access_token;

      // Met à jour la date d'expiration du token en fonction de "expires_in"
      const expiresIn = response.data.expires_in * 1000; // Convertit en millisecondes
      const now = new Date();
      this.accessTokenExpiration = new Date(now.getTime() + expiresIn);

      this.saveAccessTokenToLocalStorage(); // Enregistre le token dans le localStorage
    } catch (error) {
      console.error("Erreur lors de la récupération du token:", error);
      throw error;
    }
  }

  // Méthode privée pour enregistrer le token dans le localStorage
  private saveAccessTokenToLocalStorage(): void {
    if (this.accessToken && this.accessTokenExpiration) {
      localStorage.setItem("accessToken", this.accessToken);
      localStorage.setItem(
        "accessTokenExpiration",
        this.accessTokenExpiration.toISOString()
      );
    }
  }

  // Méthode pour récupérer le token depuis le local storage lors du démarrage de l'application
  private retrieveTokenFromLocalStorage(): void {
    const storedAccessToken = localStorage.getItem("accessToken");
    const storedAccessTokenExpiration = localStorage.getItem(
      "accessTokenExpiration"
    );

    if (storedAccessToken && storedAccessTokenExpiration) {
      this.accessToken = storedAccessToken;
      this.accessTokenExpiration = new Date(storedAccessTokenExpiration);
    }
  }

  private buildJobOffersSearchUrl(
    departmentCode: string,
    language: string
  ): string {
    return `/offres/search?departement=${departmentCode}&motsCles=${language}`;
  }

  // WS qui va chercher toutes les annonces pour un départementCode
  public async fetchAllJobOffers(departmentCode: string): Promise<JobOffer[]> {
    await this.refreshToken();

    let allOffers: JobOffer[] = [];
    let start = 0;
    let end = 149;
    const rangeLimit = 150; // Limite définie par l'API

    while (true) {
      if (start > 3000) {
        break;
      }

      if (end > 3149) {
        end = 3149; // Si 'end' dépasse 3149, on l'ajuste
      }

      const url = `/offres/search?departement=${departmentCode}&domaine=M18&range=${start}-${end}`;
      const response = await this.axiosInstance.get<JobOffersSearchResponse>(
        url,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      allOffers = [...allOffers, ...response.data.resultats];

      // Si le nombre d'offres retournées est inférieur à la limite, c'est qu'on a récupéré toutes les offres
      if (response.data.resultats.length < rangeLimit || end == 3149) {
        break;
      }

      start += rangeLimit;
      end += rangeLimit;
    }

    return allOffers;
  }

  // Méthode pour récupérer le nombre d'offres d'emploi pour un département et un langage donnés
  public async fetchJobOffersCount(
    departmentCode: string,
    language: string
  ): Promise<number> {
    await this.refreshToken(); // On s'assure que le token est à jour

    const url = this.buildJobOffersSearchUrl(departmentCode, language);

    const response = await this.axiosInstance.get<JobOffersSearchResponse>(
      url,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    // Extrait la longueur du tableau "resultats" de la réponse et la retourne
    return response.data.resultats?.length ?? 0;
  }

  // Méthode publique pour obtenir l'instance Axios (utilisée pour les tests)
  private getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  // Méthode publique pour vérifier si le token est valide
  private isAccessTokenValid(): boolean {
    return (
      this.accessToken !== null &&
      this.accessTokenExpiration !== null &&
      new Date() <
        new Date(this.accessTokenExpiration.getTime() - 5 * 60 * 1000)
    );
  }

  // Méthode publique pour supprimer le token du local storage
  private clearToken(): void {
    this.accessToken = null;
    this.accessTokenExpiration = null;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("accessTokenExpiration");
  }

  public async fetchWithRetry(
    departmentCode: string,
    language: string,
    retries: number = 5
  ): Promise<number> {
    for (let i = 0; i < retries; i++) {
      try {
        const count = await this.fetchJobOffersCount(departmentCode, language);
        return count;
      } catch (error) {
        if (
          error instanceof Error &&
          "status" in error &&
          error.status === 429 &&
          i < retries - 1
        ) {
          // Too Many Requests
          console.warn("Too Many Requests, retrying in 1 second...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second before retrying
        } else {
          throw error;
        }
      }
    }
    throw new Error("Failed to fetch data after " + retries + " retries");
  }
}

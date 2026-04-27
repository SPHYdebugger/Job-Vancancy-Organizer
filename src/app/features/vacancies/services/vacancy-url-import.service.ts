import { Injectable } from '@angular/core';

import { Vacancy } from '../../../core/models/vacancy.model';

export interface VacancyUrlImportResult {
  vacancy: Vacancy;
  sourceLabel: string;
}

interface ExtractedData {
  company: string | null;
  position: string | null;
  location: string | null;
  salaryText: string | null;
  description: string | null;
  techStack: string[];
  rawText: string;
}

interface ExtractCandidate {
  value: string;
  score: number;
}

@Injectable({
  providedIn: 'root'
})
export class VacancyUrlImportService {
  public async importFromUrl(rawUrl: string): Promise<VacancyUrlImportResult> {
    const url = this.parseUrl(rawUrl);
    if (!this.isSupportedSource(url.hostname)) {
      throw new Error('UNSUPPORTED_SOURCE');
    }
    const now = new Date().toISOString();
    const sourceLabel = this.resolveSourceLabel(url.hostname);

    const pageContent = await this.fetchPageContent(url);
    const extracted = this.extractData(url, pageContent);

    const company = extracted.company || this.fallbackCompanyFromHost(url.hostname);
    const position = extracted.position || this.fallbackPositionFromPath(url.pathname);
    const modality = this.resolveModality(extracted.rawText);
    const sourceType = this.resolveSourceType(url.hostname);
    const salaryText = extracted.salaryText || null;
    const [salaryMin, salaryMax, salaryCurrency] = this.parseSalaryRange(salaryText);

    return {
      sourceLabel,
      vacancy: {
        id: crypto.randomUUID(),
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        closedAt: null,
        company,
        position,
        domain: this.resolveDomain(position),
        location: extracted.location || null,
        headquarters: extracted.location || null,
        modality,
        employmentType: 'full_time',
        seniority: this.resolveSeniority(position),
        techStack: extracted.techStack,
        salaryText,
        salaryMin,
        salaryMax,
        salaryCurrency,
        offerSource: sourceLabel,
        sourceType,
        offerUrl: url.toString(),
        companyUrl: this.buildCompanyUrl(url),
        contactName: null,
        contactEmail: null,
        contactLinkedin: null,
        lastContactAt: null,
        applicationStatus: 'pending',
        processStage: 'Imported from URL',
        companyResponse: 'none',
        priority: 'medium',
        discoveredAt: now,
        applicationDate: null,
        lastStatusChangeAt: now,
        nextFollowUpDate: null,
        followUpPending: false,
        favorite: false,
        archived: false,
        rejectionReason: null,
        closureReason: null,
        notes: extracted.description || 'Imported from public offer URL.',
        hrObservations: null,
        tags: ['url-import', sourceLabel.toLowerCase().replace(/\s+/g, '-')]
      }
    };
  }

  private parseUrl(rawUrl: string): URL {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      throw new Error('URL is required.');
    }

    try {
      return new URL(trimmed);
    } catch {
      throw new Error('Invalid URL.');
    }
  }

  private isSupportedSource(hostname: string): boolean {
    const normalizedHost = hostname.toLowerCase();
    return normalizedHost.includes('linkedin.com') || normalizedHost.includes('infojobs.net');
  }

  private async fetchPageContent(url: URL): Promise<string> {
    const lowerHost = url.hostname.toLowerCase();
    const supplementalContent = lowerHost.includes('linkedin.com') ? await this.fetchLinkedInSupplementalContent(url) : '';

    const directContent = await this.tryFetch(url.toString());
    if (directContent) {
      return `${directContent}\n${supplementalContent}`;
    }

    const normalizedUrl = `${url.protocol}//${url.host}${url.pathname}${url.search}${url.hash}`;
    const proxyUrl = `https://r.jina.ai/http://${normalizedUrl.replace(/^https?:\/\//, '')}`;
    const proxiedContent = await this.tryFetch(proxyUrl);
    if (proxiedContent) {
      return `${proxiedContent}\n${supplementalContent}`;
    }

    return supplementalContent;
  }

  private async tryFetch(targetUrl: string): Promise<string | null> {
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text') && !contentType.includes('json') && !contentType.includes('html')) {
        return null;
      }

      return await response.text();
    } catch {
      return null;
    }
  }

  private extractData(url: URL, pageContent: string): ExtractedData {
    const normalizedContent = pageContent || '';
    const plainText = this.toPlainText(normalizedContent);
    const lowerHost = url.hostname.toLowerCase();
    const jsonLd = this.extractJsonLdJobPosting(normalizedContent);
    const metaTitle = this.extractMetaValue(normalizedContent, 'property', 'og:title') ?? this.extractHtmlTitle(normalizedContent);
    const metaDescription = this.extractMetaValue(normalizedContent, 'name', 'description');
    const twitterTitle = this.extractMetaValue(normalizedContent, 'name', 'twitter:title');
    const twitterDescription = this.extractMetaValue(normalizedContent, 'name', 'twitter:description');

    const companyCandidates: ExtractCandidate[] = [];
    const positionCandidates: ExtractCandidate[] = [];
    const locationCandidates: ExtractCandidate[] = [];
    const salaryCandidates: ExtractCandidate[] = [];
    const descriptionCandidates: ExtractCandidate[] = [];

    const companyFromJson = this.cleanTextCandidate(this.readString(this.getNestedValue(jsonLd, ['hiringOrganization', 'name'])));
    const titleFromJson = this.cleanTextCandidate(this.readString(this.getNestedValue(jsonLd, ['title'])));
    const primaryLocation = this.getNestedValue(jsonLd, ['jobLocation', 'address', 'addressLocality']);
    const locationFromArray = Array.isArray(this.getNestedValue(jsonLd, ['jobLocation']))
      ? this.getNestedValue(jsonLd, ['jobLocation', '0', 'address', 'addressLocality'])
      : null;
    const locationFromJson = this.cleanTextCandidate(this.readString(primaryLocation)) || this.cleanTextCandidate(this.readString(locationFromArray));
    const salaryFromJson =
      this.cleanTextCandidate(this.readString(this.getNestedValue(jsonLd, ['baseSalary', 'value', 'value']))) ||
      this.cleanTextCandidate(this.readString(this.getNestedValue(jsonLd, ['baseSalary', 'value', 'minValue']))) ||
      this.cleanTextCandidate(this.readString(this.getNestedValue(jsonLd, ['baseSalary', 'value', 'maxValue'])));
    const descriptionFromJson = this.cleanDescription(this.readString(this.getNestedValue(jsonLd, ['description'])));

    this.pushCandidate(companyCandidates, companyFromJson, 100);
    this.pushCandidate(positionCandidates, titleFromJson, 100);
    this.pushCandidate(locationCandidates, locationFromJson, 95);
    this.pushCandidate(salaryCandidates, salaryFromJson, 90);
    this.pushCandidate(descriptionCandidates, descriptionFromJson, 90);

    const titleFallback = this.cleanTitle(metaTitle ?? twitterTitle);
    const [positionFromTitle, companyFromTitle] = this.splitTitle(titleFallback);
    this.pushCandidate(positionCandidates, this.cleanTextCandidate(positionFromTitle), 80);
    this.pushCandidate(companyCandidates, this.cleanTextCandidate(companyFromTitle), 80);
    this.pushCandidate(descriptionCandidates, this.cleanDescription(metaDescription ?? twitterDescription), 65);

    this.extractGenericCandidates(plainText, positionCandidates, companyCandidates, locationCandidates, salaryCandidates, descriptionCandidates);

    if (lowerHost.includes('linkedin.com')) {
      this.extractLinkedInCandidates(
        url,
        normalizedContent,
        plainText,
        titleFallback,
        positionCandidates,
        companyCandidates,
        locationCandidates,
        salaryCandidates
      );
    } else if (lowerHost.includes('infojobs.net')) {
      this.extractInfoJobsCandidates(plainText, titleFallback, positionCandidates, companyCandidates, locationCandidates, salaryCandidates);
    }

    const strictCompanyCandidates = companyCandidates.filter((candidate) => this.isLikelyCompanyName(candidate.value));
    const strictPositionCandidates = positionCandidates.filter((candidate) => this.isLikelyPositionTitle(candidate.value));

    const linkedInBestStrictCompany = lowerHost.includes('linkedin.com')
      ? this.pickBestCandidate(strictCompanyCandidates.filter((candidate) => candidate.score >= 120))
      : null;
    const company =
      linkedInBestStrictCompany ||
      this.pickBestCandidate(strictCompanyCandidates) ||
      this.pickBestCandidate(companyCandidates) ||
      this.extractCompanyFromUrl(url);
    const position =
      this.pickBestCandidate(strictPositionCandidates) ||
      this.pickBestCandidate(positionCandidates) ||
      this.extractPositionFromUrl(url);
    const location = this.pickBestCandidate(locationCandidates) || this.extractLocationFromText(plainText);
    const salaryText = this.pickBestCandidate(salaryCandidates) || this.extractSalaryFromText(plainText);
    const description = this.pickBestCandidate(descriptionCandidates) || this.cleanDescription(metaDescription);

    return {
      company,
      position,
      location,
      salaryText,
      description,
      techStack: this.extractTechStack(normalizedContent),
      rawText: normalizedContent
    };
  }

  private extractLinkedInCandidates(
    sourceUrl: URL,
    htmlContent: string,
    plainText: string,
    titleFallback: string | null,
    positionCandidates: ExtractCandidate[],
    companyCandidates: ExtractCandidate[],
    locationCandidates: ExtractCandidate[],
    salaryCandidates: ExtractCandidate[]
  ): void {
    const jobId = this.extractLinkedInJobId(sourceUrl);
    if (jobId) {
      const scopedBlock = this.extractLinkedInJobScopedBlock(htmlContent, jobId);
      if (scopedBlock) {
        const scopedCompanyFromLink = this.matchFirstGroup(
          scopedBlock,
          /<a[^>]*href=["'][^"']*linkedin\.com\/company\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i
        );
        this.pushCandidate(companyCandidates, this.cleanTextCandidate(this.toPlainText(scopedCompanyFromLink ?? '')), 150);

        const scopedCompanyFromAria = this.matchFirstGroup(
          scopedBlock,
          /aria-label=["'](?:Empresa|Company),\s*([^"']{2,120})["']/i
        );
        this.pushCandidate(companyCandidates, this.cleanTextCandidate(scopedCompanyFromAria), 148);

        const scopedCompanyFromLogoAria = this.matchFirstGroup(
          scopedBlock,
          /aria-label=["'](?:Logotipo de empresa para|Company logo for)\s*([^"']{2,120})["']/i
        );
        this.pushCandidate(companyCandidates, this.cleanTextCandidate(scopedCompanyFromLogoAria), 146);

        const scopedPosition = this.matchFirstGroup(
          scopedBlock,
          /<p[^>]*>([^<]{4,180})<\/p>/i
        );
        this.pushCandidate(positionCandidates, this.cleanTextCandidate(this.toPlainText(scopedPosition ?? '')), 142);
      }
    }

    const titlePosition = this.matchFirstGroup(htmlContent, /<title>\s*([^|<]{4,180})\s*\|/i);
    const titleCompany = this.matchFirstGroup(htmlContent, /<title>\s*[^|<]{2,180}\s*\|\s*([^|<]{2,120})\s*\|/i);
    this.pushCandidate(positionCandidates, this.cleanTextCandidate(this.toPlainText(titlePosition ?? '')), 132);
    this.pushCandidate(companyCandidates, this.cleanTextCandidate(this.toPlainText(titleCompany ?? '')), 130);

    for (const companyMatch of this.matchAllGroups(
      htmlContent,
      /<a[^>]*href=["'][^"']*linkedin\.com\/company\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi
    )) {
      const company = this.cleanTextCandidate(this.toPlainText(companyMatch));
      if (company && this.isLikelyCompanyName(company)) {
        this.pushCandidate(companyCandidates, company, 108);
      }
    }

    const companyFromAnchor = this.matchFirstGroup(
      htmlContent,
      /<a[^>]*href=["']https?:\/\/(?:www\.)?linkedin\.com\/company\/[^"']+["'][^>]*>([^<]{2,100})<\/a>/i
    );
    this.pushCandidate(companyCandidates, this.cleanTextCandidate(companyFromAnchor), 122);

    const companyFromMarkdownLink = this.matchFirstGroup(
      htmlContent,
      /\[([^\]]{2,100})\]\(https?:\/\/(?:www\.)?linkedin\.com\/company\/[^\)]+\)/i
    );
    this.pushCandidate(companyCandidates, this.cleanTextCandidate(companyFromMarkdownLink), 118);

    const companyFromLogoAria = this.matchFirstGroup(
      htmlContent,
      /aria-label=["'](?:Logotipo de empresa para|Company logo for)\s*([^"']{2,120})["']/i
    );
    this.pushCandidate(companyCandidates, this.cleanTextCandidate(companyFromLogoAria), 136);

    const companyFromAria = this.matchFirstGroup(
      htmlContent,
      /aria-label=["'](?:Empresa|Company),\s*([^"']{2,120})["']/i
    );
    this.pushCandidate(companyCandidates, this.cleanTextCandidate(companyFromAria), 134);

    const linkedInPTagMatches = htmlContent.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    for (const match of linkedInPTagMatches) {
      const candidateText = this.cleanTextCandidate(this.toPlainText(match[1] ?? ''));
      if (!candidateText || !this.isLikelyPositionTitle(candidateText)) {
        continue;
      }
      if (candidateText.toLowerCase().includes('españa') || candidateText.toLowerCase().includes('en remoto')) {
        continue;
      }
      this.pushCandidate(positionCandidates, candidateText, 118);
      break;
    }

    const aboutJobBlockTitle = this.matchFirstGroup(
      htmlContent,
      /componentkey=["']JobDetails_AboutTheJob_[^"']+["'][\s\S]{0,2500}?<p[^>]*>([\s\S]{4,180}?)<\/p>/i
    );
    this.pushCandidate(positionCandidates, this.cleanTextCandidate(this.toPlainText(aboutJobBlockTitle ?? '')), 122);

    const linkedInHeadingMatches = htmlContent.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
    for (const match of linkedInHeadingMatches) {
      const candidateText = this.cleanTextCandidate(this.toPlainText(match[1] ?? ''));
      if (!candidateText || !this.isLikelyPositionTitle(candidateText)) {
        continue;
      }
      this.pushCandidate(positionCandidates, candidateText, 116);
      break;
    }

    for (const candidateText of this.matchAllGroups(htmlContent, /"title"\s*:\s*"([^"]{4,180})"/gi)) {
      const cleaned = this.cleanTextCandidate(this.decodeJsonEscapes(candidateText));
      if (cleaned && this.isLikelyPositionTitle(cleaned)) {
        this.pushCandidate(positionCandidates, cleaned, 114);
      }
    }

    for (const candidateText of this.matchAllGroups(htmlContent, /"(?:companyName|company|company_name)"\s*:\s*"([^"]{2,140})"/gi)) {
      const cleaned = this.cleanTextCandidate(this.decodeJsonEscapes(candidateText));
      if (cleaned && this.isLikelyCompanyName(cleaned)) {
        this.pushCandidate(companyCandidates, cleaned, 114);
      }
    }

    const titleCompanySplit = this.matchFirstGroup(titleFallback ?? '', /(.*?)\s*[-|]\s*([^|]{2,90})/i);
    if (titleCompanySplit) {
      const split = (titleFallback ?? '').split(/[-|]/).map((value) => value.trim()).filter(Boolean);
      if (split.length >= 2) {
        this.pushCandidate(positionCandidates, this.cleanTextCandidate(split[0]), 110);
        this.pushCandidate(companyCandidates, this.cleanTextCandidate(split[1]), 108);
      }
    }

    const firstHeading = this.matchFirstGroup(plainText, /^#\s+([^\n|]{3,120})/m);
    this.pushCandidate(positionCandidates, this.cleanTextCandidate(firstHeading), 95);

    const companyFromTitle = this.matchFirstGroup(titleFallback ?? '', /\s+at\s+([^|·-]{2,80})/i);
    this.pushCandidate(companyCandidates, this.cleanTextCandidate(companyFromTitle), 92);

    const linkedInCompanyPatterns = [
      /company[:\s]+([^\n|]{2,90})/i,
      /empresa[:\s]+([^\n|]{2,90})/i,
      /\babout\s+([A-Z][A-Za-z0-9&.,'\- ]{2,80})\b/i
    ];
    for (const pattern of linkedInCompanyPatterns) {
      this.pushCandidate(companyCandidates, this.cleanTextCandidate(this.matchFirstGroup(plainText, pattern)), 82);
    }

    const linkedInLocationPatterns = [
      /location[:\s]+([^\n|]{2,120})/i,
      /ubicaci[oó]n[:\s]+([^\n|]{2,120})/i,
      /([A-Z][A-Za-zÀ-ÿ'\- ]+,\s*[A-Z][A-Za-zÀ-ÿ'\- ]+,\s*[A-Z][A-Za-zÀ-ÿ'\- ]{2,})/
    ];
    for (const pattern of linkedInLocationPatterns) {
      this.pushCandidate(locationCandidates, this.cleanTextCandidate(this.matchFirstGroup(plainText, pattern)), 84);
    }

    this.pushCandidate(salaryCandidates, this.extractSalaryFromText(plainText), 75);
  }

  private extractInfoJobsCandidates(
    plainText: string,
    titleFallback: string | null,
    positionCandidates: ExtractCandidate[],
    companyCandidates: ExtractCandidate[],
    locationCandidates: ExtractCandidate[],
    salaryCandidates: ExtractCandidate[]
  ): void {
    const infoJobsTitlePatterns = [
      /^#\s+([^\n|]{3,120})/m,
      /^([^\n]+?)\s+en\s+[^\n]+$/im,
      /^([^\n]+?)\s*-\s*Ofertas de trabajo/im
    ];
    for (const pattern of infoJobsTitlePatterns) {
      this.pushCandidate(positionCandidates, this.cleanTextCandidate(this.matchFirstGroup(titleFallback ?? plainText, pattern)), 90);
    }

    const infoJobsCompanyPatterns = [
      /\ben\s+([A-Z][A-Za-z0-9&.,'\- ]{2,90})/i,
      /empresa[:\s]+([^\n|]{2,90})/i,
      /company[:\s]+([^\n|]{2,90})/i
    ];
    for (const pattern of infoJobsCompanyPatterns) {
      this.pushCandidate(companyCandidates, this.cleanTextCandidate(this.matchFirstGroup(plainText, pattern)), 86);
    }

    const infoJobsLocationPatterns = [
      /ubicaci[oó]n[:\s]+([^\n|]{2,120})/i,
      /lugar de trabajo[:\s]+([^\n|]{2,120})/i,
      /localidad[:\s]+([^\n|]{2,120})/i
    ];
    for (const pattern of infoJobsLocationPatterns) {
      this.pushCandidate(locationCandidates, this.cleanTextCandidate(this.matchFirstGroup(plainText, pattern)), 86);
    }

    this.pushCandidate(salaryCandidates, this.extractSalaryFromText(plainText), 78);
  }

  private extractGenericCandidates(
    plainText: string,
    positionCandidates: ExtractCandidate[],
    companyCandidates: ExtractCandidate[],
    locationCandidates: ExtractCandidate[],
    salaryCandidates: ExtractCandidate[],
    descriptionCandidates: ExtractCandidate[]
  ): void {
    const genericTitlePatterns = [
      /^#\s+([^\n|]{3,120})/m,
      /^([A-Z][^\n|]{3,120})\s+at\s+([A-Z][^\n|]{2,80})/im,
      /^([A-Z][^\n|]{3,120})\s+en\s+([A-Z][^\n|]{2,80})/im
    ];

    for (const pattern of genericTitlePatterns) {
      const match = plainText.match(pattern);
      if (!match) {
        continue;
      }
      this.pushCandidate(positionCandidates, this.cleanTextCandidate(match[1] ?? null), 72);
      if (match[2]) {
        this.pushCandidate(companyCandidates, this.cleanTextCandidate(match[2]), 72);
      }
    }

    const genericLocationPatterns = [
      /(?:location|ubicaci[oó]n|sede|headquarters)[:\s]+([^\n|]{2,120})/i,
      /\b(remote|hybrid|on-site|onsite|presencial)\b/i
    ];
    for (const pattern of genericLocationPatterns) {
      this.pushCandidate(locationCandidates, this.cleanTextCandidate(this.matchFirstGroup(plainText, pattern)), 64);
    }

    this.pushCandidate(salaryCandidates, this.extractSalaryFromText(plainText), 66);

    const firstMeaningfulParagraph = plainText
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 50 && line.length < 300);
    this.pushCandidate(descriptionCandidates, this.cleanDescription(firstMeaningfulParagraph ?? null), 58);
  }

  private extractJsonLdJobPosting(content: string): Record<string, unknown> | null {
    const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const matches = content.matchAll(scriptRegex);

    for (const match of matches) {
      const rawJson = match[1]?.trim();
      if (!rawJson) {
        continue;
      }

      try {
        const parsed = JSON.parse(rawJson);
        const candidate = this.findJobPostingNode(parsed);
        if (candidate) {
          return candidate;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private findJobPostingNode(node: unknown): Record<string, unknown> | null {
    if (!node) {
      return null;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = this.findJobPostingNode(item);
        if (found) {
          return found;
        }
      }
      return null;
    }

    if (typeof node !== 'object') {
      return null;
    }

    const typedNode = node as Record<string, unknown>;
    const nodeType = `${typedNode['@type'] ?? ''}`.toLowerCase();
    if (nodeType.includes('jobposting')) {
      return typedNode;
    }

    const graph = typedNode['@graph'];
    if (graph) {
      return this.findJobPostingNode(graph);
    }

    return null;
  }

  private extractMetaValue(content: string, attrName: 'property' | 'name', attrValue: string): string | null {
    if (!content) {
      return null;
    }

    const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<meta[^>]*${attrName}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
    const match = content.match(regex);
    return match?.[1]?.trim() || null;
  }

  private extractHtmlTitle(content: string): string | null {
    const match = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match?.[1]) {
      return null;
    }

    return this.cleanTitle(match[1]);
  }

  private cleanTitle(value: string | null): string | null {
    if (!value) {
      return null;
    }

    return value
      .replace(/\s+/g, ' ')
      .replace(/\|.*$/, '')
      .replace(/- LinkedIn.*$/i, '')
      .replace(/- InfoJobs.*$/i, '')
      .trim();
  }

  private splitTitle(title: string | null): [string | null, string | null] {
    if (!title) {
      return [null, null];
    }

    const separators = [' at ', ' en ', ' @ ', ' - '];
    for (const separator of separators) {
      const index = title.toLowerCase().indexOf(separator.trim().toLowerCase());
      if (index <= 0) {
        continue;
      }

      const [left, right] = title.split(new RegExp(separator, 'i'));
      const position = left?.trim() || null;
      const company = right?.trim() || null;
      if (position && company) {
        return [position, company];
      }
    }

    return [title, null];
  }

  private extractLocationFromText(content: string): string | null {
    const plainText = this.toPlainText(content).toLowerCase();
    if (plainText.includes('remote')) {
      return 'Remote';
    }
    if (plainText.includes('hybrid')) {
      return 'Hybrid';
    }
    if (plainText.includes('madrid')) {
      return 'Madrid';
    }
    if (plainText.includes('barcelona')) {
      return 'Barcelona';
    }
    return null;
  }

  private extractSalaryFromText(content: string): string | null {
    const plainText = this.toPlainText(content);
    const salaryPattern = /((?:€|\$|EUR|USD)?\s?\d{2,3}(?:[.,]\d{3})?(?:\s?[kK])?(?:\s?[-–]\s?(?:€|\$|EUR|USD)?\s?\d{2,3}(?:[.,]\d{3})?(?:\s?[kK])?))/;
    const singleSalaryPattern = /((?:€|\$|EUR|USD)\s?\d{2,3}(?:[.,]\d{3})?(?:\s?[kK])?)/;
    const rangeMatch = plainText.match(salaryPattern);
    if (rangeMatch?.[1]) {
      return rangeMatch[1].trim();
    }

    const singleMatch = plainText.match(singleSalaryPattern);
    return singleMatch?.[1]?.trim() || null;
  }

  private cleanDescription(value: string | null): string | null {
    if (!value) {
      return null;
    }

    return this.toPlainText(value).slice(0, 800).trim() || null;
  }

  private cleanTextCandidate(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const cleaned = value
      .replace(/\s+/g, ' ')
      .replace(/[|•·]+/g, ' ')
      .trim();

    if (!cleaned || cleaned.length < 2) {
      return null;
    }

    if (cleaned.length > 160) {
      return cleaned.slice(0, 160).trim();
    }

    return cleaned;
  }

  private pushCandidate(target: ExtractCandidate[], value: string | null, score: number): void {
    if (!value) {
      return;
    }

    const normalized = this.cleanTextCandidate(value);
    if (!normalized) {
      return;
    }

    if (target.some((candidate) => candidate.value.toLowerCase() === normalized.toLowerCase())) {
      return;
    }

    target.push({ value: normalized, score });
  }

  private pickBestCandidate(candidates: ExtractCandidate[]): string | null {
    if (candidates.length === 0) {
      return null;
    }

    const sorted = [...candidates].sort((left, right) => right.score - left.score || right.value.length - left.value.length);
    return sorted[0]?.value ?? null;
  }

  private isLikelyCompanyName(value: string): boolean {
    const normalized = value.trim();
    if (!normalized || normalized.length < 2 || normalized.length > 90) {
      return false;
    }

    if (/^[a-z0-9-]+\.[a-z]{2,}$/i.test(normalized)) {
      return false;
    }

    const lower = normalized.toLowerCase();
    const blockedFragments = [
      'personas',
      'oficinas',
      'jobs in',
      'new jobs',
      'job search',
      'empleos',
      'oferta',
      'responsabilidades',
      'requisitos',
      'experience',
      'responsibilities',
      'job details',
      'linkedin',
      'kapa.ai'
    ];
    if (blockedFragments.some((fragment) => lower.includes(fragment))) {
      return false;
    }

    if (/[.!?]/.test(normalized) || normalized.split(',').length > 2) {
      return false;
    }

    const words = normalized.split(/\s+/);
    if (words.length > 8) {
      return false;
    }

    return /[A-Za-zÀ-ÿ]/.test(normalized);
  }

  private isLikelyPositionTitle(value: string): boolean {
    const normalized = value.trim();
    if (!normalized || normalized.length < 4 || normalized.length > 140) {
      return false;
    }

    if (/^\d+$/.test(normalized)) {
      return false;
    }

    const lower = normalized.toLowerCase();
    const blockedFragments = [
      'jobs in',
      'new jobs',
      'job search',
      'ofertas de trabajo',
      'compartido hace',
      'linkedin',
      'infojobs',
      'about the job',
      'acerca del empleo',
      'job details'
    ];
    if (blockedFragments.some((fragment) => lower.includes(fragment))) {
      return false;
    }

    const alphaChars = normalized.replace(/[^A-Za-zÀ-ÿ]/g, '').length;
    return alphaChars >= 4;
  }

  private matchFirstGroup(content: string, regex: RegExp): string | null {
    const match = content.match(regex);
    if (!match) {
      return null;
    }

    return match[1] ?? null;
  }

  private toPlainText(content: string): string {
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private extractCompanyFromUrl(url: URL): string | null {
    if (url.hostname.includes('linkedin.com')) {
      return null;
    }

    if (url.hostname.includes('infojobs.net')) {
      return null;
    }

    return null;
  }

  private extractPositionFromUrl(url: URL): string | null {
    const slug = url.pathname
      .split('/')
      .filter(Boolean)
      .pop();

    if (!slug) {
      return null;
    }

    if (/^\d+$/.test(slug)) {
      return null;
    }

    return slug
      .replace(/[-_]/g, ' ')
      .replace(/\.(html|htm)$/i, '')
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private fallbackCompanyFromHost(hostname: string): string {
    const normalizedHost = hostname.replace(/^www\./, '');
    if (normalizedHost.includes('linkedin.com')) {
      return 'LinkedIn Company';
    }
    if (normalizedHost.includes('infojobs.net')) {
      return 'InfoJobs Company';
    }
    return normalizedHost.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private fallbackPositionFromPath(pathname: string): string {
    const slug = pathname
      .split('/')
      .filter(Boolean)
      .pop();

    if (!slug) {
      return 'Backend Developer';
    }

    if (/^\d+$/.test(slug)) {
      return 'Backend Developer';
    }

    const normalized = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
    return normalized || 'Backend Developer';
  }

  private resolveSourceLabel(hostname: string): string {
    if (hostname.includes('linkedin.com')) {
      return 'LinkedIn';
    }

    if (hostname.includes('infojobs.net')) {
      return 'InfoJobs';
    }

    return 'Website';
  }

  private resolveSourceType(hostname: string): Vacancy['sourceType'] {
    if (hostname.includes('linkedin.com') || hostname.includes('infojobs.net')) {
      return 'job_board';
    }

    return 'company_site';
  }

  private resolveModality(rawText: string): Vacancy['modality'] {
    const normalized = rawText.toLowerCase();
    if (normalized.includes('hybrid') || normalized.includes('híbrido')) {
      return 'hybrid';
    }
    if (normalized.includes('on-site') || normalized.includes('onsite') || normalized.includes('presencial')) {
      return 'on_site';
    }
    return 'remote';
  }

  private resolveDomain(position: string): string | null {
    const normalized = position.toLowerCase();
    if (normalized.includes('backend') || normalized.includes('api')) {
      return 'backend';
    }
    if (normalized.includes('full stack') || normalized.includes('fullstack')) {
      return 'fullstack';
    }
    if (normalized.includes('data')) {
      return 'data';
    }
    if (normalized.includes('devops')) {
      return 'devops';
    }
    return null;
  }

  private resolveSeniority(position: string): Vacancy['seniority'] {
    const normalized = position.toLowerCase();
    if (normalized.includes('intern')) {
      return 'intern';
    }
    if (normalized.includes('junior') || normalized.includes('jr')) {
      return 'junior';
    }
    if (normalized.includes('senior') || normalized.includes('sr')) {
      return 'senior';
    }
    if (normalized.includes('lead')) {
      return 'lead';
    }
    if (normalized.includes('manager')) {
      return 'manager';
    }
    return 'mid';
  }

  private extractTechStack(rawText: string): string[] {
    const plainText = this.toPlainText(rawText).toLowerCase();
    const weightedSkills = new Map<string, number>();

    const skillDictionary: Array<{ label: string; patterns: RegExp[]; weight?: number }> = [
      { label: 'TypeScript', patterns: [/\btypescript\b/i, /\bts\b/i], weight: 3 },
      { label: 'JavaScript', patterns: [/\bjavascript\b/i, /\becmascript\b/i, /\bjs\b/i], weight: 2 },
      { label: 'Node.js', patterns: [/\bnode\.?js\b/i, /\bnode\b/i], weight: 3 },
      { label: 'NestJS', patterns: [/\bnestjs\b/i, /\bnest\.?js\b/i], weight: 3 },
      { label: 'Express', patterns: [/\bexpress\b/i, /\bexpressjs\b/i], weight: 2 },
      { label: 'Java', patterns: [/\bjava\b/i], weight: 3 },
      { label: 'Spring Boot', patterns: [/\bspring\s*boot\b/i, /\bspring\b/i], weight: 3 },
      { label: 'Python', patterns: [/\bpython\b/i], weight: 3 },
      { label: 'Django', patterns: [/\bdjango\b/i], weight: 2 },
      { label: 'FastAPI', patterns: [/\bfastapi\b/i], weight: 2 },
      { label: 'Go', patterns: [/\bgolang\b/i, /\bgo\b/i], weight: 2 },
      { label: 'PHP', patterns: [/\bphp\b/i], weight: 2 },
      { label: 'Laravel', patterns: [/\blaravel\b/i], weight: 2 },
      { label: '.NET', patterns: [/\b\.net\b/i, /\bdotnet\b/i, /\basp\.?net\b/i], weight: 3 },
      { label: 'C#', patterns: [/\bc#\b/i, /\bcsharp\b/i], weight: 2 },
      { label: 'SQL', patterns: [/\bsql\b/i, /\bmysql\b/i, /\bmariadb\b/i], weight: 3 },
      { label: 'PostgreSQL', patterns: [/\bpostgresql\b/i, /\bpostgres\b/i], weight: 3 },
      { label: 'MongoDB', patterns: [/\bmongodb\b/i, /\bmongo\b/i], weight: 2 },
      { label: 'Redis', patterns: [/\bredis\b/i], weight: 2 },
      { label: 'Elasticsearch', patterns: [/\belasticsearch\b/i, /\belk\b/i], weight: 2 },
      { label: 'Docker', patterns: [/\bdocker\b/i], weight: 3 },
      { label: 'Kubernetes', patterns: [/\bkubernetes\b/i, /\bk8s\b/i], weight: 3 },
      { label: 'AWS', patterns: [/\baws\b/i, /\bamazon web services\b/i], weight: 3 },
      { label: 'Azure', patterns: [/\bazure\b/i], weight: 2 },
      { label: 'GCP', patterns: [/\bgcp\b/i, /\bgoogle cloud\b/i], weight: 2 },
      { label: 'CI/CD', patterns: [/\bci\/cd\b/i, /\bcontinuous integration\b/i, /\bcontinuous delivery\b/i], weight: 2 },
      { label: 'Git', patterns: [/\bgit\b/i, /\bgithub\b/i, /\bgitlab\b/i, /\bbitbucket\b/i], weight: 2 },
      { label: 'Kafka', patterns: [/\bkafka\b/i], weight: 2 },
      { label: 'RabbitMQ', patterns: [/\brabbitmq\b/i], weight: 2 },
      { label: 'REST', patterns: [/\brest\b/i, /\brestful\b/i], weight: 2 },
      { label: 'GraphQL', patterns: [/\bgraphql\b/i], weight: 2 },
      { label: 'Microservices', patterns: [/\bmicroservices?\b/i, /\bmicroservicios?\b/i], weight: 2 },
      { label: 'Linux', patterns: [/\blinux\b/i], weight: 2 },
      { label: 'Terraform', patterns: [/\bterraform\b/i], weight: 2 },
      { label: 'Ansible', patterns: [/\bansible\b/i], weight: 2 },
      { label: 'Prometheus', patterns: [/\bprometheus\b/i], weight: 1 },
      { label: 'Grafana', patterns: [/\bgrafana\b/i], weight: 1 },
      { label: 'Jenkins', patterns: [/\bjenkins\b/i], weight: 1 }
    ];

    const requirementsBlock = this.extractRequirementsBlock(plainText);
    const prioritizedText = requirementsBlock ? `${requirementsBlock}\n${plainText}` : plainText;

    for (const skill of skillDictionary) {
      let hits = 0;
      for (const pattern of skill.patterns) {
        const matches = prioritizedText.match(new RegExp(pattern.source, `${pattern.flags.includes('i') ? 'i' : ''}g`));
        if (matches) {
          hits += matches.length;
        }
      }

      if (hits > 0) {
        const baseWeight = skill.weight ?? 1;
        weightedSkills.set(skill.label, hits * baseWeight);
      }
    }

    return [...weightedSkills.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([skill]) => skill)
      .slice(0, 12);
  }

  private extractRequirementsBlock(plainText: string): string {
    const sectionMarkers = [
      'requirements',
      'required skills',
      'must have',
      'nice to have',
      'qualifications',
      'tecnologias',
      'tecnologías',
      'requisitos',
      'skills',
      'stack'
    ];

    const lines = plainText
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const matchedLines: string[] = [];
    let collecting = false;
    let collected = 0;

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (sectionMarkers.some((marker) => lower.includes(marker))) {
        collecting = true;
        matchedLines.push(line);
        continue;
      }

      if (!collecting) {
        continue;
      }

      matchedLines.push(line);
      collected += 1;
      if (collected >= 40) {
        break;
      }
    }

    return matchedLines.join('\n');
  }

  private parseSalaryRange(salaryText: string | null): [number | null, number | null, string | null] {
    if (!salaryText) {
      return [null, null, null];
    }

    const currency = salaryText.includes('$') || salaryText.toLowerCase().includes('usd')
      ? 'USD'
      : salaryText.includes('€') || salaryText.toLowerCase().includes('eur')
        ? 'EUR'
        : null;

    const values = salaryText
      .replace(/,/g, '.')
      .match(/\d+(\.\d+)?/g)
      ?.map((value) => Number(value))
      .filter((value) => Number.isFinite(value)) ?? [];

    if (values.length === 0) {
      return [null, null, currency];
    }

    if (values.length === 1) {
      return [values[0], null, currency];
    }

    return [values[0], values[1], currency];
  }

  private buildCompanyUrl(url: URL): string {
    return `${url.protocol}//${url.host}`;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private getNestedValue(node: Record<string, unknown> | null, path: string[]): unknown {
    if (!node) {
      return null;
    }

    let currentValue: unknown = node;
    for (const segment of path) {
      if (currentValue == null) {
        return null;
      }

      if (Array.isArray(currentValue)) {
        const index = Number(segment);
        if (!Number.isInteger(index)) {
          return null;
        }
        currentValue = currentValue[index];
        continue;
      }

      if (typeof currentValue === 'object') {
        currentValue = (currentValue as Record<string, unknown>)[segment];
        continue;
      }

      return null;
    }

    return currentValue;
  }

  private extractLinkedInJobScopedBlock(htmlContent: string, jobId: string): string | null {
    const explicitJobHref = `/jobs/view/${jobId}`;
    const hrefIndex = htmlContent.indexOf(explicitJobHref);
    if (hrefIndex >= 0) {
      const start = Math.max(0, hrefIndex - 24000);
      const end = Math.min(htmlContent.length, hrefIndex + 9000);
      return htmlContent.slice(start, end);
    }

    const aboutKeyRegex = new RegExp(`componentkey=["']JobDetails_AboutTheJob_${jobId}["']([\\s\\S]{0,22000})`, 'i');
    const aboutMatch = htmlContent.match(aboutKeyRegex);
    if (aboutMatch?.[0]) {
      return aboutMatch[0];
    }

    return null;
  }

  private async fetchLinkedInSupplementalContent(url: URL): Promise<string> {
    const jobId = this.extractLinkedInJobId(url);
    if (!jobId) {
      return '';
    }

    const guestEndpoint = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
    const directGuest = await this.tryFetch(guestEndpoint);
    if (directGuest) {
      return directGuest;
    }

    const proxyGuest = await this.tryFetch(`https://r.jina.ai/http://${guestEndpoint.replace(/^https?:\/\//, '')}`);
    return proxyGuest ?? '';
  }

  private extractLinkedInJobId(url: URL): string | null {
    const match = url.pathname.match(/\/jobs\/view\/(\d+)/i);
    return match?.[1] ?? null;
  }

  private matchAllGroups(content: string, regex: RegExp): string[] {
    const results: string[] = [];
    const matches = content.matchAll(regex);
    for (const match of matches) {
      const group = match[1]?.trim();
      if (group) {
        results.push(group);
      }
    }
    return results;
  }

  private decodeJsonEscapes(value: string): string {
    try {
      return JSON.parse(`"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    } catch {
      return value;
    }
  }
}

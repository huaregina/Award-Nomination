import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Trophy, Award, Handshake, Home, Star, Globe, ChevronLeft, ChevronRight, UserRound, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import nominationDataUrl from './nomination_with_reason.csv?url';

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw10jtWvXdUXg69MxcmwQl3kE1CO_gzIfJu2ePllU0s0of2-gQJ4SlJAcy-s5fICQZk0g/exec';

const QUESTIONS = [
  'Did the nomination describe how this candidate meets or exceeds the expectations for excellence outlined in the category for which they are nominated?',
  'Did the nomination provide specific examples of how this candidate has contributed to, or led, the achievement of specific outcomes or improvements?',
  'Did the nomination show meaningful impact on patients, families, staff, the organization, or the broader community?',
  'Did the nomination clearly demonstrate leadership, initiative, collaboration, or innovation relevant to the category?',
  'Overall, how strongly does this nomination support recognition of this candidate in this category?'
];

const FALLBACK_CATEGORY_CONFIG = [
  {
    id: 'patient-support',
    name: 'Excellence in Patient Care Support (Non-Nursing)',
    icon: Handshake,
    nominees: [
      { id: 'haminah', name: 'Haminah Qaiyim', subtitle: 'Rehabilitation' },
      { id: 'rafael', name: 'Rafael Moralde', subtitle: 'Patient Support Services' }
    ]
  },
  {
    id: 'aprn-year',
    name: 'APRN of the Year',
    icon: Award,
    nominees: [
      { id: 'jasmine', name: 'Jasmine Lewis', subtitle: 'Advanced Practice Nursing' },
      { id: 'olivia', name: 'Olivia Carter', subtitle: 'Ambulatory Care' }
    ]
  },
  {
    id: 'community-care',
    name: 'Excellence in Community Care',
    icon: Home,
    nominees: [
      { id: 'nadia', name: 'Nadia Scott', subtitle: 'Community Outreach' },
      { id: 'aaron', name: 'Aaron Rivera', subtitle: 'Population Health' }
    ]
  },
  {
    id: 'partners',
    name: 'Partners of Nursing (Non-Nursing)',
    icon: Handshake,
    nominees: [
      { id: 'marcus', name: 'Marcus Hall', subtitle: 'Operations' },
      { id: 'lena', name: 'Lena Patel', subtitle: 'Care Coordination' }
    ]
  },
  {
    id: 'aprn-leader',
    name: 'APRN Leader',
    icon: Star,
    nominees: [
      { id: 'mia', name: 'Mia Thompson', subtitle: 'Clinical Leadership' },
      { id: 'sophia', name: 'Sophia Nguyen', subtitle: 'Nursing Administration' }
    ]
  },
  {
    id: 'public-health',
    name: 'Excellence in Public Health Care',
    icon: Globe,
    nominees: [
      { id: 'jordan', name: 'Jordan Brooks', subtitle: 'Public Health' },
      { id: 'nina', name: 'Nina Lopez', subtitle: 'Preventive Care' }
    ]
  }
];

const ICONS = [Handshake, Award, Home, Handshake, Star, Globe, Trophy];

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeNominationText(text, realName, hiddenName) {
  let sanitized = String(text || '').trim();
  const normalizedRealName = String(realName || '').trim();
  const normalizedHiddenName = String(hiddenName || '').trim();

  if (!sanitized) return '';

  sanitized = sanitized.replace(/\[NOMINEE\]/gi, normalizedHiddenName || 'Nominee');

  if (!normalizedRealName || !normalizedHiddenName) {
    return sanitized;
  }

  const fullNamePattern = new RegExp(escapeRegExp(normalizedRealName), 'gi');
  sanitized = sanitized.replace(fullNamePattern, normalizedHiddenName);

  normalizedRealName
    .split(/\s+/)
    .filter((part) => part.length >= 4)
    .forEach((part) => {
      const partPattern = new RegExp(`\\b${escapeRegExp(part)}\\b`, 'gi');
      sanitized = sanitized.replace(partPattern, normalizedHiddenName);
    });

  return sanitized;
}

function splitNominationReasons(text, nominationCount, realName, hiddenName) {
  const normalizedText = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalizedText) return [];

  const numberedParts = normalizedText
    .split(/(?:^|\n)\s*(?=\d+\.\s)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);

  const reasonPages =
    numberedParts.length > 0
      ? numberedParts
      : nominationCount > 1
      ? normalizedText
          .split(/\n\s*\n+/)
          .map((part) => part.trim())
          .filter(Boolean)
      : [normalizedText];

  return reasonPages
    .map((reason) => sanitizeNominationText(reason, realName, hiddenName))
    .filter(Boolean);
}

function buildCategoryConfigFromCsv(rows) {
  const grouped = rows.reduce((acc, row) => {
    const category = String(row.Category || '').trim();
    const name = String(row.Name || '').trim();
    const hiddenName = String(row['Hide Name'] || '').trim();
    const department = String(row.Department || '').trim();
    const nominationReason = String(row['Nomination Reason'] || '');
    const nominationCount = Number(row['Nomination Count']) || 0;

    if (!category || !name) return acc;

    if (!acc[category]) acc[category] = [];

    const nomineeId = slugify(`${category}-${hiddenName || name}`);
    const existingNominee = acc[category].find((item) => item.id === nomineeId);
    const reasonPages = splitNominationReasons(nominationReason, nominationCount, name, hiddenName || name);

    if (!existingNominee) {
      acc[category].push({
        id: nomineeId,
        name: hiddenName || name,
        realName: name,
        subtitle: department || 'Department not listed',
        reasons: reasonPages
      });
    } else if (reasonPages.length > 0) {
      existingNominee.reasons = [...existingNominee.reasons, ...reasonPages];
    }

    return acc;
  }, {});

  return Object.entries(grouped).map(([categoryName, nominees], idx) => ({
    id: slugify(categoryName),
    name: categoryName,
    icon: ICONS[idx % ICONS.length],
    nominees
  }));
}

const scoreLabels = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Excellent'
};

function isNomineeComplete(scores) {
  return QUESTIONS.every((_, idx) => typeof scores?.[idx] === 'number');
}

export default function AwardAssessmentUiMockup() {
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedNomineeId, setSelectedNomineeId] = useState(null);
  const [responses, setResponses] = useState({});
  const [categoryConfig, setCategoryConfig] = useState(FALLBACK_CATEGORY_CONFIG);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [shouldScrollToQuestions, setShouldScrollToQuestions] = useState(false);
  const [selectedNominationPage, setSelectedNominationPage] = useState(0);
  const nomineeCardRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    fetch(nominationDataUrl)
      .then((res) => {
        if (!res.ok) throw new Error('nomination_with_reason.csv not found');
        return res.text();
      })
      .then((csvText) => {
        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true
        });

        const config = buildCategoryConfigFromCsv(parsed.data || []);
        if (isMounted && config.length > 0) {
          setCategoryConfig(config);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCategoryConfig(FALLBACK_CATEGORY_CONFIG);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedCategory = useMemo(
    () => categoryConfig.find((c) => c.id === selectedCategoryId) || null,
    [categoryConfig, selectedCategoryId]
  );

  const selectedNominee = useMemo(
    () => selectedCategory?.nominees.find((n) => n.id === selectedNomineeId) || null,
    [selectedCategory, selectedNomineeId]
  );

  const categoryProgress = useMemo(() => {
    return categoryConfig.reduce((acc, category) => {
      const ratedCount = category.nominees.filter((nominee) => {
        const nomineeScores = responses[category.id]?.[nominee.id];
        return isNomineeComplete(nomineeScores);
      }).length;

      acc[category.id] = {
        ratedCount,
        total: category.nominees.length,
        complete: ratedCount === category.nominees.length && category.nominees.length > 0
      };
      return acc;
    }, {});
  }, [categoryConfig, responses]);

  const handleSelectCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
    const category = categoryConfig.find((c) => c.id === categoryId);
    setSelectedNomineeId(category?.nominees?.[0]?.id ?? null);
    setSelectedNominationPage(0);
  };

  const handleSelectNominee = (nomineeId) => {
    setSelectedNomineeId(nomineeId);
    setSelectedNominationPage(0);
    setShouldScrollToQuestions(true);
  };

  const handleScore = (questionIndex, score) => {
    if (!selectedCategoryId || !selectedNomineeId) return;
    setResponses((prev) => ({
      ...prev,
      [selectedCategoryId]: {
        ...(prev[selectedCategoryId] || {}),
        [selectedNomineeId]: {
          ...(prev[selectedCategoryId]?.[selectedNomineeId] || {}),
          [questionIndex]: score
        }
      }
    }));
  };

  const currentScores = responses[selectedCategoryId]?.[selectedNomineeId] || {};
  const nominationPages = selectedNominee?.reasons || [];
  const currentNominationText = nominationPages[selectedNominationPage] || '';

  const nomineeCountCompleted = selectedCategory
    ? categoryProgress[selectedCategory.id]?.ratedCount || 0
    : 0;

  const completedAssessments = useMemo(() => {
    return categoryConfig.flatMap((category) =>
      category.nominees
        .map((nominee) => {
          const nomineeScores = responses[category.id]?.[nominee.id];
          if (!isNomineeComplete(nomineeScores)) return null;

          const orderedScores = QUESTIONS.map((_, idx) => nomineeScores[idx]);
          const totalScore = orderedScores.reduce((sum, score) => sum + score, 0);

          return {
            categoryId: category.id,
            categoryName: category.name,
            nomineeId: nominee.id,
            nomineeName: nominee.name,
            department: nominee.subtitle,
            q1: orderedScores[0],
            q2: orderedScores[1],
            q3: orderedScores[2],
            q4: orderedScores[3],
            q5: orderedScores[4],
            totalScore,
            averageScore: Number((totalScore / QUESTIONS.length).toFixed(2))
          };
        })
        .filter(Boolean)
    );
  }, [categoryConfig, responses]);

  const handleSubmitResults = async () => {
    if (completedAssessments.length === 0) {
      setSubmitMessage('No completed nominee ratings to submit yet.');
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const payload = {
        submittedAt: new Date().toISOString(),
        source: 'award-assessment-ui',
        totalCompleted: completedAssessments.length,
        assessments: completedAssessments
      };

      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      setSubmitMessage(`Submitted ${completedAssessments.length} completed result(s).`);
    } catch (error) {
      setSubmitMessage('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!shouldScrollToQuestions || !selectedNominee) return;

    const scrollToNomineeCard = () => {
      const target = nomineeCardRef.current;
      if (!target) return false;

      const targetTop = target.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      return true;
    };

    const frameId = requestAnimationFrame(() => {
      if (scrollToNomineeCard()) {
        setShouldScrollToQuestions(false);
        return;
      }

      setTimeout(() => {
        if (scrollToNomineeCard()) {
          setShouldScrollToQuestions(false);
        }
      }, 80);
    });

    return () => cancelAnimationFrame(frameId);
  }, [selectedNominee, shouldScrollToQuestions]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#0d2047,_#06122b_45%,_#030b1d_80%)] text-white p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 rounded-2xl border border-slate-700/70 bg-slate-900/45 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-300">
              Completed results ready to submit: <span className="font-semibold text-amber-300">{completedAssessments.length}</span>
            </div>
            <button
              onClick={handleSubmitResults}
              disabled={isSubmitting}
              className="rounded-xl border border-amber-400/70 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition-all hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Results'}
            </button>
          </div>
          {submitMessage ? <div className="mt-2 text-sm text-slate-300">{submitMessage}</div> : null}
        </div>

        <AnimatePresence mode="wait">
          {!selectedCategory ? (
            <motion.div
              key="category-grid"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-3 text-amber-400">
                  <Trophy className="h-9 w-9" />
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Award Assessment</h1>
                  <Trophy className="h-9 w-9" />
                </div>
                <p className="text-slate-300 text-lg">Select a category to evaluate nominees</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {categoryConfig.map((category) => {
                  const Icon = category.icon;
                  const progress = categoryProgress[category.id] || {
                    ratedCount: 0,
                    total: category.nominees.length,
                    complete: false
                  };
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleSelectCategory(category.id)}
                      className={`group text-left rounded-3xl border p-6 min-h-[180px] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${
                        progress.complete
                          ? 'border-emerald-500/60 bg-emerald-950/30 hover:bg-emerald-900/30'
                          : 'border-slate-700/80 bg-slate-900/50 hover:border-amber-400/60 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex h-full flex-col items-center justify-between gap-4 text-center">
                        <div className={`rounded-full border p-4 ${progress.complete ? 'border-emerald-500/60 text-emerald-400' : 'border-amber-500/70 text-amber-400'}`}>
                          {progress.complete ? <CheckCircle2 className="h-7 w-7" /> : <Icon className="h-7 w-7" />}
                        </div>
                        <div className="space-y-2">
                          <div className="font-semibold text-xl leading-snug">{category.name}</div>
                          <div className={`text-sm ${progress.complete ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {progress.complete
                              ? `Completed • ${progress.ratedCount} of ${progress.total} nominees rated`
                              : `${progress.ratedCount} of ${progress.total} nominees rated`}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="category-detail"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              <div className="rounded-3xl border border-slate-800 bg-slate-950/40 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => {
                      setSelectedCategoryId(null);
                      setSelectedNomineeId(null);
                      setSelectedNominationPage(0);
                    }}
                    className="mt-1 rounded-full p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 text-amber-400">
                      <Trophy className="h-7 w-7" />
                      <h2 className="text-2xl md:text-3xl font-bold leading-tight">{selectedCategory.name}</h2>
                    </div>
                    <p className="text-slate-400">
                      {nomineeCountCompleted} of {selectedCategory.nominees.length} nominees rated
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-amber-400 font-semibold text-xl">Nominees ({selectedCategory.nominees.length})</div>
                <div className="flex flex-wrap gap-3">
                  {selectedCategory.nominees.map((nominee) => {
                    const done = isNomineeComplete(responses[selectedCategory.id]?.[nominee.id]);
                    const active = nominee.id === selectedNomineeId;
                    return (
                      <button
                        key={nominee.id}
                        onClick={() => handleSelectNominee(nominee.id)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                          done
                            ? 'border-emerald-500/70 bg-emerald-900/30 text-emerald-200'
                            : active
                            ? 'border-amber-400 bg-amber-400/10 text-amber-100'
                            : 'border-slate-600 bg-slate-900/40 text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          {done ? <CheckCircle2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                          {nominee.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedNominee && (
                <>
                  <div
                    ref={nomineeCardRef}
                    className="rounded-3xl border border-slate-700/80 bg-slate-900/45 p-4 md:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="rounded-full border border-amber-500/70 p-4 text-amber-400">
                        <UserRound className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="text-2xl md:text-3xl font-bold">{selectedNominee.name}</div>
                        <div className="text-slate-400 text-base md:text-lg">{selectedNominee.subtitle}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-700/80 bg-slate-900/45 p-5 md:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-xl md:text-2xl font-bold text-amber-300">Read Nomination</div>
                        <div className="text-sm text-slate-400">
                          {nominationPages.length > 0
                            ? `Page ${selectedNominationPage + 1} of ${nominationPages.length}`
                            : 'No nomination reason available for this nominee.'}
                        </div>
                      </div>

                      {nominationPages.length > 1 ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedNominationPage((page) => Math.max(0, page - 1))}
                            disabled={selectedNominationPage === 0}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm font-semibold text-slate-200 transition-all hover:border-amber-400 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </button>
                          <button
                            onClick={() =>
                              setSelectedNominationPage((page) => Math.min(nominationPages.length - 1, page + 1))
                            }
                            disabled={selectedNominationPage === nominationPages.length - 1}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm font-semibold text-slate-200 transition-all hover:border-amber-400 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-700/70 bg-slate-950/45 p-5 text-base leading-8 text-slate-100 whitespace-pre-wrap">
                      {currentNominationText || 'No nomination reason available for this nominee.'}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-2xl font-bold">
                      <Star className="h-6 w-6 text-amber-400" />
                      <span>Scoring Questions</span>
                    </div>

                    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/45 px-5 py-4 text-sm text-slate-200">
                      <span className="font-semibold text-amber-400 mr-2">Rating:</span>
                      <span>1 = Poor</span>
                      <span className="mx-3 text-slate-500">|</span>
                      <span>2 = Fair</span>
                      <span className="mx-3 text-slate-500">|</span>
                      <span>3 = Good</span>
                      <span className="mx-3 text-slate-500">|</span>
                      <span>4 = Excellent</span>
                    </div>

                    {QUESTIONS.map((question, idx) => {
                      const currentScore = currentScores[idx];
                      return (
                        <div
                          key={idx}
                          className="rounded-3xl border border-slate-700/70 bg-slate-900/45 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                        >
                          <div className="flex gap-4 items-start">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/70 bg-amber-500/10 font-bold text-amber-300">
                              {idx + 1}
                            </div>
                            <div className="space-y-6 flex-1">
                              <p className="text-lg md:text-2xl leading-relaxed font-semibold text-slate-100">{question}</p>
                              <div className="grid grid-cols-4 gap-2 md:gap-3">
                                {[1, 2, 3, 4].map((value) => {
                                  const selected = currentScore === value;
                                  return (
                                    <button
                                      key={value}
                                      onClick={() => handleScore(idx, value)}
                                      className={`rounded-xl md:rounded-2xl border px-2 py-3 md:px-4 md:py-5 transition-all ${
                                        selected
                                          ? 'border-amber-400 bg-amber-400/12 text-white shadow-[0_0_0_1px_rgba(251,191,36,0.35)]'
                                          : 'border-slate-600 bg-slate-900/35 text-slate-200 hover:border-slate-400'
                                      }`}
                                    >
                                      <div className="text-xl md:text-3xl font-bold">{value}</div>
                                      <div className="mt-1 md:mt-2 text-[11px] md:text-sm text-slate-400">{scoreLabels[value]}</div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="rounded-xl border border-slate-600 bg-slate-900/45 px-3 py-2 text-xs md:text-sm font-semibold text-slate-200 transition-all hover:border-amber-400 hover:text-amber-200"
                      >
                        Back to Top
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
